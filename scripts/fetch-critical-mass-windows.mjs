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
const cacheDir = '/tmp/cm-viz'
mkdirSync(cacheDir, { recursive: true })

const WINDOWS = {
  y2026: ['2026-01-01', '2026-10-29'],
  oct: ['2026-10-01', '2026-10-29']
}
const TYPE = { member: 'Games.type', operator: 'equals', values: ['game'] }
const REVIEW_ORDER = [
  'Overwhelmingly Positive', 'Very Positive', 'Mostly Positive', 'Positive', 'Mixed',
  'Mostly Negative', 'Negative', 'Very Negative', 'Overwhelmingly Negative',
  '1–9 reviews', 'No user reviews', 'No score recorded'
]
const TITLE_STOP = new Set('a an the of and or to in on for with from by at vs into your you my our its it is be as not no nor but if we they them their this that these those game games'.split(' '))
const DISCLOSURE_STOP = new Set(`${[...TITLE_STOP].join(' ')} was were are been has have had some any all other such during which who what when where than then also only own can may will would could should about over under out up per via being both each more most less very just so do does did done there here how whom whose while after before between within without through across against because since until onto off including`.split(/\s+/))

function isTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function reviewLabel(score) {
  const text = score || ''
  if (!text) return 'No score recorded'
  if (/^[1-9] user reviews$/.test(text)) return '1–9 reviews'
  return text
}

function blankReviews() {
  return Object.fromEntries(REVIEW_ORDER.map((label) => [label, 0]))
}

async function load(query) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query }) })
    const body = await res.json()
    if (body.error && /continue wait|timeout/i.test(String(body.error))) {
      if (attempt === 1 || attempt % 5 === 0) console.error('wait', attempt, query.dimensions?.join(',') || '')
      await new Promise((resolve) => setTimeout(resolve, 2500))
      continue
    }
    if (body.error) throw new Error(String(body.error).slice(0, 500))
    return body.data || []
  }
  throw new Error('Cube retries exhausted')
}

function baseFilters(ai, range) {
  return {
    timeDimensions: [{ dimension: 'Games.releaseDate', dateRange: range }],
    filters: [TYPE, { member: 'Games.madeWithAi', operator: 'equals', values: [ai] }]
  }
}

async function topTags(ai, range) {
  const rows = await load({
    measures: ['Games.count'],
    dimensions: ['GameTags.tag'],
    ...baseFilters(ai, range),
    filters: [...baseFilters(ai, range).filters, { member: 'GameTags.tag', operator: 'set' }],
    order: [['Games.count', 'desc']],
    limit: 50
  })
  return rows
    .map((row) => ({ name: row['GameTags.tag'], count: Number(row['Games.count']) || 0 }))
    .filter((row) => row.name && row.count)
}

async function tagCounts(ai, range, names) {
  const counts = new Map()
  for (let index = 0; index < names.length; index += 8) {
    const chunk = names.slice(index, index + 8)
    const rows = await load({
      measures: ['Games.count'],
      dimensions: ['GameTags.tag'],
      ...baseFilters(ai, range),
      filters: [
        ...baseFilters(ai, range).filters,
        { member: 'GameTags.tag', operator: 'equals', values: chunk }
      ],
      limit: chunk.length
    })
    for (const row of rows) counts.set(row['GameTags.tag'], Number(row['Games.count']) || 0)
    for (const name of chunk) if (!counts.has(name)) counts.set(name, 0)
  }
  return counts
}

async function disclosures(range, cacheName) {
  const cachePath = `${cacheDir}/${cacheName}`
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'))
  const seen = new Set()
  const texts = []
  let lastId = null
  for (let page = 0; page < 20; page++) {
    const batch = await load({
      dimensions: ['Games.appId', 'Games.madeWithAiDisclosure'],
      ...baseFilters(true, range),
      filters: [
        ...baseFilters(true, range).filters,
        ...(lastId == null ? [] : [{ member: 'Games.appId', operator: 'gt', values: [lastId] }])
      ],
      order: [['Games.appId', 'asc']],
      limit: 2000
    })
    if (!batch.length) break
    for (const row of batch) {
      const appId = Number(row['Games.appId'])
      if (seen.has(appId)) continue
      seen.add(appId)
      texts.push(row['Games.madeWithAiDisclosure'] || '')
    }
    const nextId = Math.max(...batch.map((row) => Number(row['Games.appId'])))
    console.error(cacheName, 'page', page, 'unique', seen.size)
    if (batch.length < 2000 || nextId === lastId) break
    lastId = nextId
  }
  writeFileSync(cachePath, JSON.stringify(texts))
  return texts
}

function wordCloud(entries, limit = 80) {
  return [...entries.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

function titleWords(games) {
  const counts = new Map()
  for (const game of games) {
    const tokens = String(game.name || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2 && !TITLE_STOP.has(token))
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)
  }
  return wordCloud(counts)
}

function disclosureWords(texts) {
  const counts = new Map()
  let filled = 0
  for (const text of texts) {
    const source = String(text || '').trim()
    if (!source) continue
    filled += 1
    const tokens = new Set(
      source
        .toLowerCase()
        .replace(/['’]/g, '')
        .split(/[^a-z0-9-]+/)
        .map((token) => token.replace(/^-+|-+$/g, ''))
        .filter((token) => token.length >= 2 && !DISCLOSURE_STOP.has(token) && !/^[0-9-]+$/.test(token))
    )
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)
  }
  return {
    disclosureWords: wordCloud(counts),
    disclosureStatements: filled,
    disclosureBlank: texts.length - filled
  }
}

function round1(value) {
  return Math.round(value * 10) / 10
}

const aiGames = JSON.parse(readFileSync(`${cacheDir}/ai-games.json`, 'utf8'))
const out = {}

for (const [key, range] of Object.entries(WINDOWS)) {
  console.error('window', key, range.join('..'))
  const games = aiGames.filter((game) => game.date >= range[0] && game.date <= range[1])
  const aiReviews = blankReviews()
  let unscored = 0
  for (const game of games) {
    aiReviews[reviewLabel(game.score)] += 1
    const total = (game.positive || 0) + (game.negative || 0)
    if (total <= 0) unscored += 1
  }

  const [freeRows, reviewRows, aiTags, otherTags] = await Promise.all([
    load({
      measures: ['Games.count'],
      dimensions: ['Games.isFree', 'Games.madeWithAi'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange: range }],
      filters: [TYPE]
    }),
    load({
      measures: ['Games.count'],
      dimensions: ['Games.reviewScoreDesc', 'Games.madeWithAi'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange: range }],
      filters: [TYPE],
      limit: 500
    }),
    topTags(true, range),
    topTags(false, range)
  ])

  const freePaid = { ai: { free: 0, paid: 0 }, other: { free: 0, paid: 0 } }
  for (const row of freeRows) {
    const count = Number(row['Games.count']) || 0
    const side = isTrue(row['Games.madeWithAi']) ? freePaid.ai : freePaid.other
    if (isTrue(row['Games.isFree'])) side.free += count
    else side.paid += count
  }

  const otherReviews = blankReviews()
  for (const row of reviewRows) {
    if (isTrue(row['Games.madeWithAi'])) continue
    const label = reviewLabel(row['Games.reviewScoreDesc'])
    if (otherReviews[label] == null) otherReviews[label] = 0
    otherReviews[label] += Number(row['Games.count']) || 0
  }

  const aiTotal = freePaid.ai.free + freePaid.ai.paid
  const otherTotal = freePaid.other.free + freePaid.other.paid
  const names = [...new Set([...aiTags.map((tag) => tag.name), ...otherTags.map((tag) => tag.name)])]
  const aiKnown = new Map(aiTags.map((tag) => [tag.name, tag.count]))
  const otherKnown = new Map(otherTags.map((tag) => [tag.name, tag.count]))
  const [aiFilled, otherFilled] = await Promise.all([
    tagCounts(true, range, names.filter((name) => !aiKnown.has(name))),
    tagCounts(false, range, names.filter((name) => !otherKnown.has(name)))
  ])
  const aiMap = new Map([...aiKnown, ...aiFilled])
  const otherMap = new Map([...otherKnown, ...otherFilled])
  const clusters = names.map((name) => ({
    name,
    ai: aiMap.get(name) || 0,
    other: otherMap.get(name) || 0,
    x: otherTotal ? round1(((otherMap.get(name) || 0) / otherTotal) * 100) : 0,
    y: aiTotal ? round1(((aiMap.get(name) || 0) / aiTotal) * 100) : 0
  })).filter((tag) => tag.x > 0 && tag.y > 0)

  const texts = await disclosures(range, `disclosures-${key}.json`)
  out[key] = {
    freePaid,
    tags: aiTags.map((tag) => ({ name: tag.name, ai: tag.count })),
    clusters,
    reviews: { ai: aiReviews, other: otherReviews },
    words: titleWords(games),
    unscored,
    aiGames: games.length,
    ...disclosureWords(texts)
  }
  console.error(key, {
    ai: aiTotal,
    other: otherTotal,
    cachedAi: games.length,
    tags: out[key].tags.length,
    clusters: clusters.length,
    unscored,
    statements: out[key].disclosureStatements
  })
}

const dest = new URL('../public/blog/critical-mass-windows.json', import.meta.url)
writeFileSync(dest, JSON.stringify(out))
console.log('wrote', dest.pathname)
