import { readFileSync } from 'fs'

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
  for (let attempt = 1; attempt <= 15; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query }) })
    const body = await res.json()
    if (body.error && /continue wait|timeout/i.test(String(body.error))) {
      console.error('wait', attempt)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      continue
    }
    if (body.error) throw new Error(String(body.error).slice(0, 700))
    return body.data || []
  }
  throw new Error('retries')
}

const sample = await load({
  dimensions: ['PriceHistory.appId', 'PriceHistory.initialPrice', 'PriceHistory.finalPrice', 'PriceHistory.price', 'PriceHistory.timestamp'],
  timeDimensions: [{ dimension: 'PriceHistory.timestamp', dateRange: ['2020-01-01', '2026-10-29'] }],
  order: [['PriceHistory.timestamp', 'desc']],
  limit: 8
})
console.log('sample', JSON.stringify(sample, null, 2))

const monthly = await load({
  measures: ['PriceHistory.count'],
  timeDimensions: [{ dimension: 'PriceHistory.timestamp', granularity: 'year', dateRange: ['2020-01-01', '2026-10-29'] }]
})
console.log('yearly', JSON.stringify(monthly, null, 2))
