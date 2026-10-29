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
      if (attempt === 1 || attempt % 5 === 0) console.error('wait', attempt, String(body.error).slice(0, 120))
      await new Promise((resolve) => setTimeout(resolve, 3000))
      continue
    }
    if (body.error) throw new Error(String(body.error).slice(0, 500))
    return body.data || []
  }
  throw new Error('Cube retries exhausted')
}

function baseFilters(ai) {
  return [
    { member: 'Games.type', operator: 'equals', values: ['game'] },
    { member: 'Games.madeWithAi', operator: 'equals', values: [ai] }
  ]
}

async function eachPage(makeQuery) {
  const rows = []
  let lastId = null
  for (let page = 0; page < 40; page++) {
    const query = makeQuery(lastId)
    const batch = await load(query)
    if (!batch.length) break
    rows.push(...batch)
    const ids = batch.map((row) => Number(row['Games.appId'])).filter((id) => Number.isFinite(id))
    const nextId = Math.max(...ids)
    console.error(`page ${page} +${batch.length} total ${rows.length} last ${nextId}`)
    if (batch.length < query.limit || nextId === lastId) break
    lastId = nextId
  }
  return rows
}

function num(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function quantile(sorted, p) {
  if (!sorted.length) return null
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sorted[low]
  return sorted[low] * (high - index) + sorted[high] * (index - low)
}

function boxOf(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr
  const whiskerLow = sorted.find((value) => value >= lowFence)
  const whiskerHigh = [...sorted].reverse().find((value) => value <= highFence)
  const outliers = sorted.filter((value) => value < lowFence || value > highFence)
  const sample = (list, cap) => {
    if (list.length <= cap) return list
    return Array.from({ length: cap }, (_, index) => list[Math.round((index * (list.length - 1)) / (cap - 1))])
  }
  return {
    n: sorted.length,
    min: round1(sorted[0]),
    q1: round1(q1),
    median: round1(median),
    q3: round1(q3),
    max: round1(sorted[sorted.length - 1]),
    whiskerLow: round1(whiskerLow),
    whiskerHigh: round1(whiskerHigh),
    outlierCount: outliers.length,
    outlierSample: sample(outliers, 80).map(round1)
  }
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function kmeans(points, k = 4) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length
  const sd = (list, avg) => Math.sqrt(list.reduce((sum, value) => sum + (value - avg) ** 2, 0) / list.length) || 1
  const xAvg = mean(xs)
  const yAvg = mean(ys)
  const xSd = sd(xs, xAvg)
  const ySd = sd(ys, yAvg)
  const z = points.map((point) => ({
    point,
    x: (point.x - xAvg) / xSd,
    y: (point.y - yAvg) / ySd
  }))
  let centers = Array.from({ length: k }, (_, index) => {
    const source = z[Math.floor((index * z.length) / k)]
    return { x: source.x, y: source.y }
  })
  let labels = new Array(z.length).fill(0)
  for (let iter = 0; iter < 30; iter++) {
    labels = z.map((item) => {
      let best = 0
      let bestDist = Infinity
      centers.forEach((center, index) => {
        const dist = (item.x - center.x) ** 2 + (item.y - center.y) ** 2
        if (dist < bestDist) {
          bestDist = dist
          best = index
        }
      })
      return best
    })
    centers = centers.map((_, index) => {
      const members = z.filter((item, itemIndex) => labels[itemIndex] === index)
      if (!members.length) return centers[index]
      return {
        x: mean(members.map((item) => item.x)),
        y: mean(members.map((item) => item.y))
      }
    })
  }
  return labels
}

const STOP = new Set('a an the of and or to in on for with from by at vs into your you my our its it is be as not no nor but if we they them their this that these those game games'.split(' '))

const RIBS = [
  { name: 'Genre', names: ['Indie', 'Casual', 'Action', 'Adventure', 'Simulation', 'Strategy', 'RPG', 'Puzzle', 'Arcade', 'Horror', 'Shooter', 'Management'] },
  { name: 'Players', names: ['Singleplayer', 'Multiplayer', 'PvE', 'PvP'] },
  { name: 'Look', names: ['2D', '3D', 'Pixel Graphics', 'Colorful', 'Cute', 'Stylized', 'Realistic', 'Retro'] },
  { name: 'Mood', names: ['Atmospheric', 'Relaxing', 'Funny', 'Dark', 'Fantasy', 'Sci-fi', 'Mystery', 'Psychological Horror'] },
  { name: 'Viewpoint', names: ['First-Person', 'Third Person', 'Top-Down'] },
  { name: 'Structure', names: ['Early Access', 'Exploration', 'Story Rich', 'Choices Matter', 'Linear', 'Multiple Endings', 'Roguelike', 'Roguelite', 'Immersive Sim', 'Combat', 'Free to Play', 'Family Friendly', 'Action-Adventure', 'Resource Management', 'Controller'] }
]

console.error('ai games')
let aiGames = readCache('ai-games.json')
if (!aiGames) {
const aiRows = await eachPage((lastId) => ({
  measures: ['Games.totalPositiveReviews', 'Games.totalNegativeReviews'],
  dimensions: ['Games.appId', 'Games.name', 'Games.reviewScoreDesc', 'Games.releaseDate', 'Games.totalReviewsValue'],
  timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
  filters: [
    ...baseFilters(true),
    ...(lastId == null ? [] : [{ member: 'Games.appId', operator: 'gt', values: [lastId] }])
  ],
  order: [['Games.appId', 'asc']],
  limit: 5000
}))

const seen = new Set()
aiGames = []
for (const row of aiRows) {
  const appId = Number(row['Games.appId'])
  if (seen.has(appId)) continue
  seen.add(appId)
  aiGames.push({
    name: row['Games.name'] || '',
    date: String(row['Games.releaseDate'] || '').slice(0, 10),
    score: row['Games.reviewScoreDesc'] || null,
    total: num(row['Games.totalReviewsValue']),
    positive: num(row['Games.totalPositiveReviews']),
    negative: num(row['Games.totalNegativeReviews'])
  })
}
console.error('unique ai', aiGames.length)
writeCache('ai-games.json', aiGames)
}

console.error('other games')
let otherPercents = readCache('other-percents.json')
let otherTotal = readCache('other-total.json')
if (!otherPercents || otherTotal == null) {
const otherRows = await eachPage((lastId) => ({
  measures: ['Games.totalPositiveReviews', 'Games.totalNegativeReviews'],
  dimensions: ['Games.appId', 'Games.totalReviewsValue'],
  timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
  filters: [
    ...baseFilters(false),
    ...(lastId == null ? [] : [{ member: 'Games.appId', operator: 'gt', values: [lastId] }])
  ],
  order: [['Games.appId', 'asc']],
  limit: 8000
}))
const otherSeen = new Set()
otherPercents = []
for (const row of otherRows) {
  const appId = Number(row['Games.appId'])
  if (otherSeen.has(appId)) continue
  otherSeen.add(appId)
  const positive = num(row['Games.totalPositiveReviews'])
  const negative = num(row['Games.totalNegativeReviews'])
  const total = (positive || 0) + (negative || 0)
  if (total > 0) otherPercents.push((positive / total) * 100)
}
otherTotal = otherSeen.size
console.error('other scored', otherPercents.length, 'of', otherTotal)
writeCache('other-percents.json', otherPercents)
writeCache('other-total.json', otherTotal)
} else {
console.error('other cache', otherPercents.length, 'of', otherTotal)
}

function reviewTotal(game) {
  if (game.total != null) return game.total
  if (game.positive == null && game.negative == null) return null
  return (game.positive || 0) + (game.negative || 0)
}

function percent(game) {
  const positive = game.positive || 0
  const negative = game.negative || 0
  const total = positive + negative
  if (total <= 0) return null
  return (positive / total) * 100
}

const BANDS = ['95–100%', '80–94%', '70–79%', '40–69%', 'Under 40%']
function bandIndex(value) {
  if (value >= 95) return 0
  if (value >= 80) return 1
  if (value >= 70) return 2
  if (value >= 40) return 3
  return 4
}

const byMonth = new Map()
let unscored = 0
for (const game of aiGames) {
  const value = percent(game)
  const month = game.date.slice(0, 7)
  if (!month || month.length < 7) continue
  if (value == null) {
    unscored += 1
    continue
  }
  if (!byMonth.has(month)) byMonth.set(month, [0, 0, 0, 0, 0])
  byMonth.get(month)[bandIndex(value)] += 1
}
const months = [...byMonth.keys()].sort()
const streamCounts = BANDS.map((_, index) => months.map((month) => byMonth.get(month)[index]))
const streamSeries = BANDS.map((_, index) => months.map((month) => {
  const counts = byMonth.get(month)
  const total = counts.reduce((sum, value) => sum + value, 0)
  return total ? (counts[index] / total) * 100 : 0
}))

const SCORE_ORDER = [
  '10 or fewer reviews',
  'No score recorded',
  'Overwhelmingly Negative',
  'Very Negative',
  'Negative',
  'Mostly Negative',
  'Mixed',
  'Positive',
  'Mostly Positive',
  'Very Positive',
  'Overwhelmingly Positive'
]
const polar = {}
SCORE_ORDER.forEach((label) => { polar[label] = {} })
for (const game of aiGames) {
  const year = game.date.slice(0, 4)
  if (!year) continue
  const reviews = reviewTotal(game)
  let label = 'No score recorded'
  if (reviews == null || reviews <= 10) label = '10 or fewer reviews'
  else if (game.score) label = game.score
  if (!polar[label]) polar[label] = {}
  polar[label][year] = (polar[label][year] || 0) + 1
}
const years = [...new Set(aiGames.map((game) => game.date.slice(0, 4)).filter(Boolean))].sort()
const polarGroups = SCORE_ORDER.filter((label) => years.some((year) => polar[label]?.[year]))

const words = new Map()
for (const game of aiGames) {
  const tokens = game.name
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP.has(token))
  for (const token of tokens) words.set(token, (words.get(token) || 0) + 1)
}
const wordCloud = [...words.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 80)
  .map(([name, value]) => ({ name, value }))

async function topTags(ai, limit) {
  const rows = await load({
    measures: ['Games.count'],
    dimensions: ['GameTags.tag'],
    timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
    filters: [...baseFilters(ai), { member: 'GameTags.tag', operator: 'set' }],
    order: [['Games.count', 'desc']],
    limit
  })
  return rows.map((row) => ({
    name: row['GameTags.tag'],
    count: Number(row['Games.count']) || 0
  })).filter((row) => row.name && row.count)
}

console.error('tags')
const [aiTags, otherTags] = await Promise.all([topTags(true, 50), topTags(false, 50)])
const aiTagMap = new Map(aiTags.map((tag) => [tag.name, tag.count]))
const otherTagMap = new Map(otherTags.map((tag) => [tag.name, tag.count]))

async function fillTagCounts(ai, names) {
  const target = ai ? aiTagMap : otherTagMap
  for (let index = 0; index < names.length; index += 8) {
    const chunk = names.slice(index, index + 8)
    if (!chunk.length) continue
    const rows = await load({
      measures: ['Games.count'],
      dimensions: ['GameTags.tag'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
      filters: [
        ...baseFilters(ai),
        { member: 'GameTags.tag', operator: 'equals', values: chunk }
      ],
      limit: chunk.length
    })
    for (const row of rows) {
      const name = row['GameTags.tag']
      if (name) target.set(name, Number(row['Games.count']) || 0)
    }
    chunk.forEach((name) => { if (!target.has(name)) target.set(name, 0) })
  }
}

await fillTagCounts(true, otherTags.map((tag) => tag.name).filter((name) => !aiTagMap.has(name)))
await fillTagCounts(false, aiTags.map((tag) => tag.name).filter((name) => !otherTagMap.has(name)))

const aiTotal = aiGames.length
const clusterTags = [...new Set([...aiTags.map((tag) => tag.name), ...otherTags.map((tag) => tag.name)])]
  .map((name) => ({
    name,
    ai: aiTagMap.get(name) || 0,
    other: otherTagMap.get(name) || 0,
    x: otherTotal ? ((otherTagMap.get(name) || 0) / otherTotal) * 100 : 0,
    y: aiTotal ? ((aiTagMap.get(name) || 0) / aiTotal) * 100 : 0
  }))
  .filter((tag) => tag.ai + tag.other > 0)
const clusterLabels = kmeans(clusterTags, 4)
const clusterCenters = [0, 1, 2, 3].map((index) => {
  const members = clusterTags.filter((_, tagIndex) => clusterLabels[tagIndex] === index)
  const avg = (key) => members.reduce((sum, tag) => sum + tag[key], 0) / (members.length || 1)
  return { index, x: avg('x'), y: avg('y'), n: members.length }
})
function clusterName(center) {
  const gap = center.y - center.x
  if (Math.abs(gap) < 4) {
    if (center.y >= 30) return 'Common on both'
    if (center.y < 14) return 'Narrower tags'
    return 'Same mix, on fewer games'
  }
  if (gap >= 8) return 'More common on AI games'
  if (gap <= -8) return 'More common on other games'
  return gap > 0 ? 'Leans toward AI games' : 'Leans toward other games'
}
const nameByIndex = new Map(clusterCenters.map((center) => [center.index, clusterName(center)]))
const clusters = clusterTags.map((tag, index) => ({
  name: tag.name,
  x: round1(tag.x),
  y: round1(tag.y),
  ai: tag.ai,
  other: tag.other,
  cluster: nameByIndex.get(clusterLabels[index])
}))

const fishbone = RIBS.map((rib) => ({
  name: rib.name,
  tags: rib.names
    .map((name) => ({ name, count: aiTagMap.get(name) || 0 }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
})).filter((rib) => rib.tags.length)

async function tagAppIds(ai, tag) {
  const key = `ids-${ai ? 'ai' : 'other'}-${tag.replace(/[^a-z0-9]+/gi, '_')}.json`
  const cached = readCache(key)
  if (cached) {
    console.error('ids cache', ai ? 'ai' : 'other', tag, cached.length)
    return new Set(cached)
  }
  const ids = new Set()
  let lastId = null
  for (let page = 0; page < 20; page++) {
    const batch = await load({
      dimensions: ['Games.appId'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
      filters: [
        ...baseFilters(ai),
        { member: 'GameTags.tag', operator: 'equals', values: [tag] },
        ...(lastId == null ? [] : [{ member: 'Games.appId', operator: 'gt', values: [lastId] }])
      ],
      order: [['Games.appId', 'asc']],
      limit: 10000
    })
    if (!batch.length) break
    batch.forEach((row) => ids.add(Number(row['Games.appId'])))
    const nextId = Math.max(...batch.map((row) => Number(row['Games.appId'])))
    console.error(`ids ${ai ? 'ai' : 'other'} ${tag} +${batch.length} set ${ids.size}`)
    if (batch.length < 10000 || nextId === lastId) break
    lastId = nextId
  }
  writeCache(key, [...ids])
  return ids
}

async function chordFor(ai, tags) {
  const labels = tags.slice(0, 8).map((tag) => tag.name)
  console.error('chord', ai ? 'ai' : 'other', labels.join(', '))
  const sets = []
  for (const label of labels) sets.push(await tagAppIds(ai, label))
  const matrix = labels.map((_, row) => labels.map((__, column) => {
    if (row === column) return 0
    if (row > column) return null
    let count = 0
    const [small, large] = sets[row].size < sets[column].size ? [sets[row], sets[column]] : [sets[column], sets[row]]
    for (const id of small) if (large.has(id)) count += 1
    return count
  }))
  for (let row = 0; row < labels.length; row++) {
    for (let column = 0; column < row; column++) matrix[row][column] = matrix[column][row]
  }
  return { labels, matrix, volumes: labels.map((label) => (ai ? aiTagMap : otherTagMap).get(label) || 0) }
}

console.error('chords')
const chords = {
  ai: await chordFor(true, aiTags),
  other: await chordFor(false, otherTags)
}

const aiPercents = aiGames.map(percent).filter((value) => value != null)

const DISCLOSURE_STOP = new Set(`${[...STOP].join(' ')} including`.split(/\s+/))
let disclosureTexts = readCache('disclosures.json')
if (!disclosureTexts) {
  const seenDisclosure = new Set()
  disclosureTexts = []
  let lastDisclosureId = null
  for (let page = 0; page < 30; page++) {
    const batch = await load({
      dimensions: ['Games.appId', 'Games.madeWithAiDisclosure'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
      filters: [
        ...baseFilters(true),
        ...(lastDisclosureId == null ? [] : [{ member: 'Games.appId', operator: 'gt', values: [lastDisclosureId] }])
      ],
      order: [['Games.appId', 'asc']],
      limit: 2000
    })
    if (!batch.length) break
    for (const row of batch) {
      const appId = Number(row['Games.appId'])
      if (seenDisclosure.has(appId)) continue
      seenDisclosure.add(appId)
      disclosureTexts.push(row['Games.madeWithAiDisclosure'] || '')
    }
    const nextId = Math.max(...batch.map((row) => Number(row['Games.appId'])))
    console.error(`disclosure page ${page} unique ${seenDisclosure.size}`)
    if (batch.length < 2000 || nextId === lastDisclosureId) break
    lastDisclosureId = nextId
  }
  writeCache('disclosures.json', disclosureTexts)
}
const disclosureCounts = new Map()
let disclosureStatements = 0
for (const text of disclosureTexts) {
  const source = String(text || '').trim()
  if (!source) continue
  disclosureStatements += 1
  const tokens = new Set(
    source
      .toLowerCase()
      .replace(/['’]/g, '')
      .split(/[^a-z0-9-]+/)
      .map((token) => token.replace(/^-+|-+$/g, ''))
      .filter((token) => token.length >= 2 && !DISCLOSURE_STOP.has(token) && !/^[0-9-]+$/.test(token))
  )
  for (const token of tokens) disclosureCounts.set(token, (disclosureCounts.get(token) || 0) + 1)
}
const freeRows = await load({
  measures: ['Games.count'],
  dimensions: ['Games.isFree', 'Games.madeWithAi'],
  timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
  filters: [{ member: 'Games.type', operator: 'equals', values: ['game'] }]
})
const freePaid = { ai: { free: 0, paid: 0 }, other: { free: 0, paid: 0 } }
for (const row of freeRows) {
  const count = Number(row['Games.count']) || 0
  const side = row['Games.madeWithAi'] === true || row['Games.madeWithAi'] === 'true' ? freePaid.ai : freePaid.other
  const free = row['Games.isFree'] === true || row['Games.isFree'] === 'true' || row['Games.isFree'] === 1 || row['Games.isFree'] === '1'
  if (free) side.free += count
  else side.paid += count
}

const disclosureWords = [...disclosureCounts.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 80)
  .map(([name, value]) => ({ name, value }))

const viz = {
  asOf: '2026-10-29',
  aiGames: aiTotal,
  otherGames: otherTotal,
  stream: {
    months,
    bands: BANDS,
    series: streamSeries,
    counts: streamCounts,
    scored: aiPercents.length,
    unscored
  },
  boxplot: {
    ai: boxOf(aiPercents),
    other: boxOf(otherPercents)
  },
  fishbone,
  polar: {
    years,
    groups: polarGroups,
    series: Object.fromEntries(polarGroups.map((label) => [label, years.map((year) => polar[label][year] || 0)]))
  },
  chords,
  words: wordCloud,
  disclosureWords,
  disclosureStatements,
  disclosureBlank: disclosureTexts.length - disclosureStatements,
  freePaid,
  initialPrice: (() => {
    const priceGames = readCache('games-for-price.json')
    const priceApps = readCache('initial-price-by-app.json')
    if (!priceGames || !priceApps) return undefined
    const priceByApp = new Map(priceApps)
    const months = []
    for (let year = 2020; year <= 2026; year++) {
      const lastMonth = year === 2026 ? 10 : 12
      for (let month = 1; month <= lastMonth; month++) months.push(`${year}-${String(month).padStart(2, '0')}`)
    }
    const slotOf = new Map(months.map((month, slot) => [month, slot]))
    const lists = { ai: months.map(() => []), other: months.map(() => []) }
    let matchedAi = 0
    let matchedOther = 0
    for (const [appId, month, ai] of priceGames) {
      const price = priceByApp.get(appId)
      const slot = slotOf.get(month)
      if (price == null || slot == null) continue
      lists[ai ? 'ai' : 'other'][slot].push(price / 100)
      if (ai) matchedAi += 1
      else matchedOther += 1
    }
    const median = (values) => {
      if (!values.length) return null
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      return Math.round(value * 100) / 100
    }
    return {
      months,
      ai: lists.ai.map(median),
      other: lists.other.map(median),
      aiCounts: lists.ai.map((values) => values.length),
      otherCounts: lists.other.map((values) => values.length),
      matchedAi,
      matchedOther
    }
  })(),
  clusters
}

const out = new URL('../public/blog/critical-mass-viz.json', import.meta.url)
writeFileSync(out, JSON.stringify(viz))
console.error('WROTE', out.pathname, 'bytes', JSON.stringify(viz).length)
console.log(JSON.stringify({
  ai: aiTotal,
  other: otherTotal,
  scoredAi: aiPercents.length,
  scoredOther: otherPercents.length,
  months: months.length,
  words: wordCloud.length,
  chordAi: chords.ai.labels,
  clusters: [...nameByIndex.values()]
}))
