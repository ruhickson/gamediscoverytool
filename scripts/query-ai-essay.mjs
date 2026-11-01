import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const cut = line.indexOf('=')
      const key = line.slice(0, cut).trim()
      const value = line.slice(cut + 1).trim().replace(/^['"]|['"]$/g, '')
      return [key, value]
    })
)

const base = env.VITE_CUBEJS_API_URL
const token = env.VITE_CUBEJS_AUTH_TOKEN
if (!base || !token) {
  console.error('Cube env vars are missing')
  process.exit(1)
}

const RANGE = ['2020-01-01', '2026-10-29']
const TYPE = { member: 'Games.type', operator: 'equals', values: ['game'] }

async function load(query, retries = 18) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const response = await fetch(`${base}/load`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(120000)
    })
    const body = await response.json().catch(() => ({}))
    const message = typeof body.error === 'string' ? body.error : body.error?.message || ''
    if (response.ok && Array.isArray(body.data)) return body.data
    const waiting = /continue wait|timeout/i.test(message)
    if (waiting && attempt < retries) {
      console.error(`wait ${attempt}: ${query.dimensions?.join(',') || query.measures?.join(',')}`)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      continue
    }
    throw new Error(`Cube ${response.status}: ${message || 'no data'}`)
  }
  return []
}

function aiFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

const metaResponse = await fetch(`${base}/meta`, {
  headers: { Authorization: token },
  signal: AbortSignal.timeout(30000)
})
const meta = await metaResponse.json()
const cubes = (meta.cubes || [])
  .filter((cube) => ['Games', 'Genres', 'GameTags', 'Developers', 'Publishers'].includes(cube.name))
  .map((cube) => ({
    name: cube.name,
    measures: (cube.measures || []).map((item) => item.name),
    dimensions: (cube.dimensions || []).map((item) => item.name)
  }))

console.error('meta cubes', cubes.map((cube) => cube.name).join(', '))

const monthly = await load({
  measures: ['Games.count'],
  dimensions: ['Games.madeWithAi'],
  timeDimensions: [{
    dimension: 'Games.releaseDate',
    granularity: 'month',
    dateRange: RANGE
  }],
  filters: [TYPE],
  order: [['Games.releaseDate', 'asc']],
  limit: 5000
})
console.error('monthly rows', monthly.length)

const reviews = await load({
  measures: ['Games.count'],
  dimensions: ['Games.reviewScoreDesc', 'Games.madeWithAi'],
  timeDimensions: [{
    dimension: 'Games.releaseDate',
    granularity: 'year',
    dateRange: RANGE
  }],
  filters: [TYPE],
  order: [['Games.releaseDate', 'asc']],
  limit: 5000
})
console.error('review rows', reviews.length)

const genres = await load({
  measures: ['Games.count'],
  dimensions: ['Genres.name', 'Games.madeWithAi'],
  timeDimensions: [{
    dimension: 'Games.releaseDate',
    dateRange: RANGE
  }],
  filters: [TYPE, { member: 'Genres.name', operator: 'set' }],
  order: [['Games.count', 'desc']],
  limit: 500
})
console.error('genre rows', genres.length)

async function topTags(declared) {
  return load({
    measures: ['Games.count'],
    dimensions: ['GameTags.tag'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange: RANGE
    }],
    filters: [
      TYPE,
      { member: 'Games.madeWithAi', operator: 'equals', values: [declared] },
      { member: 'GameTags.tag', operator: 'set' }
    ],
    order: [['Games.count', 'desc']],
    limit: 20
  })
}

const [tagsDeclared, tagsOther] = await Promise.all([topTags(true), topTags(false)])
console.error('tag rows', tagsDeclared.length, tagsOther.length)

const tagNames = [...new Set([
  ...tagsDeclared.map((row) => row['GameTags.tag']),
  ...tagsOther.map((row) => row['GameTags.tag'])
].filter(Boolean))]

const tagSplit = await load({
  measures: ['Games.count'],
  dimensions: ['GameTags.tag', 'Games.madeWithAi'],
  timeDimensions: [{
    dimension: 'Games.releaseDate',
    dateRange: RANGE
  }],
  filters: [
    TYPE,
    { member: 'GameTags.tag', operator: 'equals', values: tagNames }
  ],
  limit: 500
})
console.error('tag split rows', tagSplit.length)

const out = {
  asOf: '2026-10-29',
  range: RANGE,
  type: 'game',
  cubes,
  monthly,
  reviews,
  genres,
  tagSplit
}
writeFileSync('/tmp/ai-essay-data.json', JSON.stringify(out))
console.error('wrote /tmp/ai-essay-data.json')
