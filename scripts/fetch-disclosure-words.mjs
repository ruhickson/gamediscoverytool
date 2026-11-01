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
const cachePath = `${cacheDir}/disclosures.json`

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

let texts = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : null
if (!texts) {
  const seen = new Set()
  texts = []
  let lastId = null
  for (let page = 0; page < 30; page++) {
    const batch = await load({
      dimensions: ['Games.appId', 'Games.madeWithAiDisclosure'],
      timeDimensions: [{ dimension: 'Games.releaseDate', dateRange }],
      filters: [
        { member: 'Games.type', operator: 'equals', values: ['game'] },
        { member: 'Games.madeWithAi', operator: 'equals', values: ['true'] },
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
    console.error(`page ${page} +${batch.length} unique ${seen.size} last ${nextId}`)
    if (batch.length < 2000 || nextId === lastId) break
    lastId = nextId
  }
  writeFileSync(cachePath, JSON.stringify(texts))
  console.error('cached', texts.length)
}

const STOP = new Set(`a an the of and or to in on for with from by at vs into your you my our its it is be as not no nor but if we they them their this that these those was were are been has have had some any all other such during which who what when where than then also only own can may will would could should about over under out up per via being both each more most less very just so do does did done there here how whom whose while after before between within without through across against because since until onto off including`.split(/\s+/))

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
      .filter((token) => token.length >= 2 && !STOP.has(token) && !/^[0-9-]+$/.test(token))
  )
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)
}
const words = [...counts.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 80)
  .map(([name, value]) => ({ name, value }))

const vizPath = new URL('../public/blog/critical-mass-viz.json', import.meta.url)
const viz = JSON.parse(readFileSync(vizPath, 'utf8'))
viz.disclosureWords = words
viz.disclosureStatements = filled
viz.disclosureBlank = texts.length - filled
writeFileSync(vizPath, JSON.stringify(viz))
console.log(JSON.stringify({ games: texts.length, filled, blank: texts.length - filled, top: words.slice(0, 25) }, null, 2))
