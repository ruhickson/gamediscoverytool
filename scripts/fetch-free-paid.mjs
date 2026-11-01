import { readFileSync, writeFileSync } from 'fs'

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

async function load(query) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query }) })
    const body = await res.json()
    if (body.error && /continue wait|timeout/i.test(String(body.error))) {
      console.error('wait', attempt)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      continue
    }
    if (body.error) throw new Error(String(body.error).slice(0, 400))
    return body.data || []
  }
  throw new Error('Cube retries exhausted')
}

const rows = await load({
  measures: ['Games.count'],
  dimensions: ['Games.isFree', 'Games.madeWithAi'],
  timeDimensions: [{ dimension: 'Games.releaseDate', dateRange: ['2020-01-01', '2026-10-29'] }],
  filters: [{ member: 'Games.type', operator: 'equals', values: ['game'] }]
})

function isTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

const freePaid = {
  ai: { free: 0, paid: 0 },
  other: { free: 0, paid: 0 }
}
for (const row of rows) {
  const count = Number(row['Games.count']) || 0
  const side = isTrue(row['Games.madeWithAi']) ? freePaid.ai : freePaid.other
  if (isTrue(row['Games.isFree'])) side.free += count
  else side.paid += count
}

const vizPath = new URL('../public/blog/critical-mass-viz.json', import.meta.url)
const viz = JSON.parse(readFileSync(vizPath, 'utf8'))
viz.freePaid = freePaid
writeFileSync(vizPath, JSON.stringify(viz))
console.log(JSON.stringify({ rows, freePaid }, null, 2))
