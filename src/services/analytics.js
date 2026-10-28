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

export function linkDetails(href, origin = '') {
  if (!href) return {}
  let url
  try {
    url = new URL(href, origin || (typeof location !== 'undefined' ? location.origin : 'https://gamediscoverytool.com'))
  } catch {
    return {}
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'steampowered.com' || host.endsWith('.steampowered.com')) {
    const appMatch = url.pathname.match(/\/app\/(\d+)/)
    const details = { destination: 'steam' }
    if (appMatch) details.appId = Number(appMatch[1])
    return details
  }
  if (host === 'isthereanydeal.com' || host.endsWith('.isthereanydeal.com')) {
    const slugMatch = url.pathname.match(/\/game\/([^/]+)/)
    const details = { destination: 'itad' }
    if (slugMatch) details.gameSlug = decodeURIComponent(slugMatch[1])
    return details
  }
  const base = origin || (typeof location !== 'undefined' ? location.origin : '')
  if (base && url.origin === base && (url.pathname === '/blog' || url.pathname.startsWith('/blog/'))) {
    const slug = decodeURIComponent(url.pathname.replace(/^\/blog\/?/, '').replace(/\/$/, ''))
    return { destination: 'blog', slug }
  }
  return {}
}

function nearbyGameName(el) {
  const row = el.closest?.('tr, li')
  if (!row) return ''
  const nameLink = row.querySelector('a[href*="steampowered.com"], a.game-link')
  if (!nameLink || nameLink === el) return ''
  return (nameLink.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function onClick(event) {
  const el = event.target?.closest?.(
    'a, button, [role="tab"], [role="button"], summary, label, select, input, textarea, .sortable'
  )
  if (!el || el.closest('canvas')) return
  const href = el.tagName === 'A' ? el.getAttribute('href') || '' : ''
  const details = linkDetails(href)
  const text = clickText(el).replace(/\s+/g, ' ').trim().slice(0, 120)
  const gameName = details.destination === 'steam' || details.destination === 'itad'
    ? (nearbyGameName(el) || (details.destination === 'steam' && text && text !== 'Steam' ? text : ''))
    : ''
  track('click', {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    role: el.getAttribute('role') || '',
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    text,
    href: href.slice(0, 300),
    checked: el.tagName === 'INPUT' ? !!el.checked : undefined,
    ...details,
    ...(gameName ? { gameName } : {})
  })
}

export function installAnalytics(router) {
  if (installed || typeof window === 'undefined') return
  installed = true
  document.addEventListener('click', onClick, true)
  router.afterEach((to) => {
    const properties = {
      name: String(to.name || ''),
      path: to.path,
      query: { ...to.query }
    }
    if (to.path === '/blog' || to.path.startsWith('/blog/')) {
      properties.destination = 'blog'
      properties.slug = to.params?.slug ? String(to.params.slug) : ''
    }
    track('page_view', properties, productForPath(to.path))
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
