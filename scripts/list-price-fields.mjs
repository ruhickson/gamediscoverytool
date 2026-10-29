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
const res = await fetch(env.VITE_CUBEJS_API_URL + '/meta', {
  headers: { Authorization: env.VITE_CUBEJS_AUTH_TOKEN }
})
const body = await res.json()
for (const cube of body.cubes || []) {
  if (cube.name !== 'PriceHistory' && cube.name !== 'Games') continue
  const fields = [...(cube.dimensions || []), ...(cube.measures || [])]
    .filter((dim) => /price|free|ai|release|type|appId|timestamp|currency/i.test(dim.name))
    .map((dim) => ({
      name: dim.name,
      type: dim.type,
      agg: dim.aggType,
      title: dim.title,
      description: dim.description || ''
    }))
  console.log('\n##', cube.name)
  console.log(JSON.stringify(fields, null, 2))
}
