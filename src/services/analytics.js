const USER_KEY = 'gdt_analytics_user'
const SESSION_KEY = 'gdt_analytics_session'
const SESSION_IDLE_MS = 30 * 60 * 1000
const ENDPOINT = '/.netlify/functions/analytics'
const FLUSH_MS = 1500
const MAX_QUEUE = 200

const queue = []
let timer = 0
let flushing = false
let installed = false
let nextDelay = FLUSH_MS

export function productForPath(path) {
  const value = String(path || '')
  if (value === '/find' || value.startsWith('/find/')) return 'find_a_game'
  if (value === '/diiig' || value.startsWith('/diiig/') || value === '/dig' || value.startsWith('/dig/')) return 'diiig'
  if (value === '/recommender' || value.startsWith('/recommender/')) return 'recommender'
  return 'site'
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const next = char === 'x' ? rand : (rand & 0x3) | 0x8
    return next.toString(16)
  })
}

function readIdentity() {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) {
    userId = uuid()
    localStorage.setItem(USER_KEY, userId)
  }
  let session = null
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    session = null
  }
  const now = Date.now()
  if (!session?.id || now - Number(session.lastSeen || 0) > SESSION_IDLE_MS) {
    session = {
      id: uuid(),
      startedAt: new Date().toISOString(),
      lastSeen: now,
      landingPath: `${location.pathname}${location.search}`,
      referrer: document.referrer || ''
    }
  }
  session.lastSeen = now
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { userId, session }
}

function payload(events) {
  const { userId, session } = readIdentity()
  return {
    user: {
      id: userId,
      locale: navigator.language || '',
      userAgent: (navigator.userAgent || '').slice(0, 300)
    },
    session: {
      id: session.id,
      startedAt: session.startedAt,
      landingPath: session.landingPath,
      referrer: session.referrer || ''
    },
    events
  }
}

function scheduleFlush(delay = nextDelay) {
  if (timer) return
  timer = window.setTimeout(() => {
    timer = 0
    flush(false)
  }, delay)
}

async function flush(useBeacon) {
  if (!queue.length || flushing) return
  const batch = queue.splice(0, 40)
  const body = JSON.stringify(payload(batch))
  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    if (!navigator.sendBeacon(ENDPOINT, blob)) queue.unshift(...batch)
    return
  }
  flushing = true
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    })
    if (!response.ok) throw new Error(String(response.status))
    nextDelay = FLUSH_MS
  } catch {
    queue.unshift(...batch)
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
    nextDelay = Math.min(Math.max(nextDelay * 2, 5000), 30000)
  } finally {
    flushing = false
    if (queue.length) scheduleFlush(nextDelay)
  }
}

export function track(eventName, properties = {}, product) {
  if (typeof window === 'undefined') return
  const path = `${location.pathname}${location.search}`
  queue.push({
    occurredAt: new Date().toISOString(),
    product: product || productForPath(location.pathname),
    eventName,
    path,
    properties: properties && typeof properties === 'object' ? properties : {}
  })
  if (queue.length >= 20) {
    if (timer) {
      window.clearTimeout(timer)
      timer = 0
    }
    flush(false)
    return
  }
  scheduleFlush()
}

function clickText(el) {
  if (el.tagName === 'SELECT') {
    return el.options?.[el.selectedIndex]?.text || ''
  }
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return ''
  return el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || ''
}

function onClick(event) {
  const el = event.target?.closest?.(
    'a, button, [role="tab"], [role="button"], summary, label, select, input, textarea, canvas'
  )
  if (!el) return
  const href = el.tagName === 'A' ? el.getAttribute('href') || '' : ''
  track('click', {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    role: el.getAttribute('role') || '',
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    text: clickText(el).replace(/\s+/g, ' ').trim().slice(0, 120),
    href: href.slice(0, 300),
    checked: el.tagName === 'INPUT' ? !!el.checked : undefined
  })
}

export function installAnalytics(router) {
  if (installed || typeof window === 'undefined') return
  installed = true
  document.addEventListener('click', onClick, true)
  router.afterEach((to) => {
    track('page_view', {
      name: String(to.name || ''),
      path: to.path,
      query: { ...to.query }
    }, productForPath(to.path))
  })
  const leave = () => flush(true)
  window.addEventListener('pagehide', leave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave()
  })
}

export function pendingAnalyticsCount() {
  return queue.length
}
