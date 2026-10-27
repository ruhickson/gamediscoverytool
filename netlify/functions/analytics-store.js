const PRODUCTS = new Set(['site', 'find_a_game', 'diiig', 'recommender'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_RE = /^[a-z][a-z0-9_]{0,63}$/
const BLOCKED_KEYS = new Set([
  'password', 'token', 'secret', 'authorization', 'cookie', 'email'
])
const MAX_EVENTS = 40
const MAX_STRING = 2000
const MAX_DEPTH = 5

function cleanString(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max)
}

function cleanValue(value, depth) {
  if (value == null) return null
  if (typeof value === 'string') return cleanString(value, MAX_STRING)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (depth >= MAX_DEPTH) return null
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => cleanValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      const name = cleanString(key, 64)
      if (!name || BLOCKED_KEYS.has(name.toLowerCase())) continue
      out[name] = cleanValue(item, depth + 1)
    }
    return out
  }
  return null
}

function requireUuid(value, label) {
  const id = cleanString(value, 36)
  if (!UUID_RE.test(id)) {
    const error = new Error(`Invalid ${label}`)
    error.statusCode = 400
    throw error
  }
  return id
}

function normalizeBatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Invalid payload')
    error.statusCode = 400
    throw error
  }
  const userIn = body.user || {}
  const sessionIn = body.session || {}
  const user = {
    id: requireUuid(userIn.id, 'user id'),
    userAgent: cleanString(userIn.userAgent, 300),
    locale: cleanString(userIn.locale, 35)
  }
  const session = {
    id: requireUuid(sessionIn.id, 'session id'),
    userId: user.id,
    startedAt: cleanString(sessionIn.startedAt, 40) || new Date().toISOString(),
    landingPath: cleanString(sessionIn.landingPath, 500),
    referrer: cleanString(sessionIn.referrer, 500)
  }
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_EVENTS) {
    const error = new Error('Invalid events')
    error.statusCode = 400
    throw error
  }
  const events = body.events.map((item) => {
    const eventName = cleanString(item && item.eventName, 64)
    const product = cleanString(item && item.product, 32)
    if (!EVENT_RE.test(eventName) || !PRODUCTS.has(product)) {
      const error = new Error('Invalid event')
      error.statusCode = 400
      throw error
    }
    const occurredAt = cleanString(item.occurredAt, 40) || new Date().toISOString()
    return {
      occurredAt,
      userId: user.id,
      sessionId: session.id,
      product,
      eventName,
      path: cleanString(item.path, 500),
      properties: cleanValue(item.properties, 0) || {}
    }
  })
  return { user, session, events }
}

function createMemorySink() {
  return {
    users: new Map(),
    sessions: new Map(),
    events: [],
    async upsertUser(user, seenAt) {
      const existing = this.users.get(user.id)
      this.users.set(user.id, {
        id: user.id,
        firstSeenAt: existing ? existing.firstSeenAt : seenAt,
        lastSeenAt: seenAt,
        userAgent: user.userAgent,
        locale: user.locale
      })
    },
    async upsertSession(session, seenAt) {
      const existing = this.sessions.get(session.id)
      this.sessions.set(session.id, {
        ...session,
        startedAt: existing ? existing.startedAt : session.startedAt,
        lastSeenAt: seenAt
      })
    },
    async insertEvents(events) {
      this.events.push(...events)
    }
  }
}

function createPgSink(connectionString) {
  const { Pool } = require('pg')
  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000
  })
  return {
    async upsertUser(user, seenAt) {
      await pool.query(
        `INSERT INTO analytics_users (id, first_seen_at, last_seen_at, user_agent, locale)
         VALUES ($1, $2, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET last_seen_at = EXCLUDED.last_seen_at,
               user_agent = EXCLUDED.user_agent,
               locale = EXCLUDED.locale`,
        [user.id, seenAt, user.userAgent || null, user.locale || null]
      )
    },
    async upsertSession(session, seenAt) {
      await pool.query(
        `INSERT INTO analytics_sessions (id, user_id, started_at, last_seen_at, landing_path, referrer)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET last_seen_at = EXCLUDED.last_seen_at`,
        [
          session.id,
          session.userId,
          session.startedAt,
          seenAt,
          session.landingPath || null,
          session.referrer || null
        ]
      )
    },
    async insertEvents(events) {
      if (!events.length) return
      const values = []
      const rows = events.map((event, index) => {
        const base = index * 7
        values.push(
          event.occurredAt,
          event.userId,
          event.sessionId,
          event.product,
          event.eventName,
          event.path || null,
          JSON.stringify(event.properties || {})
        )
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb)`
      })
      await pool.query(
        `INSERT INTO analytics_events
           (occurred_at, user_id, session_id, product, event_name, path, properties)
         VALUES ${rows.join(', ')}`,
        values
      )
    },
    async close() {
      await pool.end()
    }
  }
}

async function ingest(body, sink) {
  const batch = normalizeBatch(body)
  const seenAt = new Date().toISOString()
  await sink.upsertUser(batch.user, seenAt)
  await sink.upsertSession(batch.session, seenAt)
  await sink.insertEvents(batch.events)
  return { ok: true, accepted: batch.events.length, userId: batch.user.id, sessionId: batch.session.id }
}

function createHandler(sink) {
  return async function handler(event) {
    if (!event || event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) }
    }
    try {
      const body = JSON.parse(event.body || '{}')
      const result = await ingest(body, sink)
      return { statusCode: 200, body: JSON.stringify(result) }
    } catch (err) {
      const statusCode = err.statusCode || 500
      const message = statusCode === 400 ? err.message : 'Server error'
      return { statusCode, body: JSON.stringify({ ok: false, error: message }) }
    }
  }
}

module.exports = {
  PRODUCTS,
  normalizeBatch,
  createMemorySink,
  createPgSink,
  ingest,
  createHandler
}
