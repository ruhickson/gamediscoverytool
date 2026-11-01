import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    })
)
const url = env.VITE_CUBEJS_API_URL + '/load'
const headers = {
  Authorization: env.VITE_CUBEJS_AUTH_TOKEN,
  'Content-Type': 'application/json'
}
const dateRange = ['2020-01-01', '2026-10-29']
const cacheDir = '/tmp/cm-viz'
mkdirSync(cacheDir, { recursive: true })

function readCache(name) {
  const path = `${cacheDir}/${name}`
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}
function writeCache(name, value) {
  writeFileSync(`${cacheDir}/${name}`, JSON.stringify(value))
}

async function load(query) {
  for (let attempt = 1; attempt <= 40; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query }) })
    const body = await res.json()
    if (body.error && /continue wait|timeout/i.test(String(body.error))) {
      if (attempt === 1 || attempt % 5 === 0) console.error('wait', attempt)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      continue
    }
    if (body.error) throw new Error(String(body.error).slice(0, 500))
    return body.data || []
  }
  throw new Error('Cube retries exhausted')
}

let games = readCache('games-for-price.json')
if (!games) {
  games = []
  const seen = new Set()
  let lastId = null
  for (let page = 0; page < 40; page++) {
    const batch = await load({
      dimensions: ['Games.appId', 'Games.releaseDate', 'Games.madeWithAi'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
      filters: [
        { member: 'Games.type', operator: 'equals', values: ['game'] },
        ...(lastId == null ? [] : [{ member: 'Games.appId', operator: 'gt', values: [lastId] }])
      ],
      order: [['Games.appId', 'asc']],
      limit: 8000
    })
    if (!batch.length) break
    for (const row of batch) {
      const appId = Number(row['Games.appId'])
      if (seen.has(appId)) continue
      seen.add(appId)
      const ai = row['Games.madeWithAi'] === true || row['Games.madeWithAi'] === 'true'
      games.push([appId, String(row['Games.releaseDate'] || '').slice(0, 7), ai ? 1 : 0])
    }
    const nextId = Math.max(...batch.map((row) => Number(row['Games.appId'])))
    console.error(`games page ${page} unique ${seen.size} last ${nextId}`)
    if (batch.length < 8000 || nextId === lastId) break
    lastId = nextId
  }
  writeCache('games-for-price.json', games)
  console.error('cached games', games.length)
}

let prices = readCache('initial-price-by-app.json')
if (!prices) {
  const latest = new Map()
  let offset = 0
  for (let page = 0; page < 40; page++) {
    const batch = await load({
      dimensions: ['PriceHistory.appId', 'PriceHistory.initialPrice', 'PriceHistory.timestamp'],
      timeDimensions: [{ dimension: 'PriceHistory.timestamp', dateRange: ['2020-01-01', '2026-10-29'] }],
      order: [['PriceHistory.appId', 'asc'], ['PriceHistory.timestamp', 'desc']],
      limit: 8000,
      offset
    })
    if (!batch.length) break
    for (const row of batch) {
      const appId = Number(row['PriceHistory.appId'])
      const price = Number(row['PriceHistory.initialPrice'])
      const ts = String(row['PriceHistory.timestamp'] || '')
      if (!Number.isFinite(price)) continue
      const current = latest.get(appId)
      if (!current || ts > current[1]) latest.set(appId, [price, ts])
    }
    console.error(`prices page ${page} rows ${batch.length} apps ${latest.size} offset ${offset}`)
    offset += batch.length
    if (batch.length < 8000) break
  }
  prices = [...latest.entries()].map(([appId, pair]) => [appId, pair[0]])
  writeCache('initial-price-by-app.json', prices)
  console.error('cached prices', prices.length)
}

const priceByApp = new Map(prices)
const months = []
for (let year = 2020; year <= 2026; year++) {
  const lastMonth = year === 2026 ? 10 : 12
  for (let month = 1; month <= lastMonth; month++) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
  }
}
const index = new Map(months.map((month, slot) => [month, slot]))
const lists = { ai: months.map(() => []), other: months.map(() => []) }
let matchedAi = 0
let matchedOther = 0
for (const [appId, month, ai] of games) {
  const price = priceByApp.get(appId)
  const slot = index.get(month)
  if (price == null || slot == null) continue
  lists[ai ? 'ai' : 'other'][slot].push(price / 100)
  if (ai) matchedAi += 1
  else matchedOther += 1
}
function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.round(value * 100) / 100
}
const initialPrice = {
  months,
  ai: lists.ai.map(median),
  other: lists.other.map(median),
  aiCounts: lists.ai.map((values) => values.length),
  otherCounts: lists.other.map((values) => values.length),
  matchedAi,
  matchedOther
}
const vizPath = new URL('../public/blog/critical-mass-viz.json', import.meta.url)
const viz = JSON.parse(readFileSync(vizPath, 'utf8'))
viz.initialPrice = initialPrice
writeFileSync(vizPath, JSON.stringify(viz))
const priced = initialPrice.ai.map((value, i) => [months[i], value, initialPrice.other[i], initialPrice.aiCounts[i], initialPrice.otherCounts[i]]).filter((row) => row[1] != null || row[2] != null)
console.log(JSON.stringify({ matchedAi, matchedOther, games: games.length, prices: prices.length, sample: priced.slice(0, 6), last: priced.slice(-4) }, null, 2))
