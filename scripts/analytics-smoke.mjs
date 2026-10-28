import { readFileSync } from 'node:fs'
import { linkDetails } from '../src/services/analytics.js'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { createMemorySink, createHandler, createSupabaseSink } = require(join(root, 'netlify/functions/analytics-store.js'))

const userId = '11111111-1111-4111-8111-111111111111'
const sessionId = '22222222-2222-4222-8222-222222222222'
const startedAt = '2026-10-27T18:00:00.000Z'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const sql = readFileSync(join(root, 'db/analytics.sql'), 'utf8')
for (const table of ['analytics_users', 'analytics_sessions', 'analytics_events']) {
  assert(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `schema is missing ${table}`)
}
assert(sql.includes("CHECK (product IN ('site', 'find_a_game', 'diiig', 'recommender'))"), 'schema does not separate the products')
assert(sql.includes('properties jsonb'), 'schema is missing the search-parameter column')
assert(sql.includes('CREATE OR REPLACE FUNCTION analytics_ingest'), 'schema is missing the Supabase ingest function')
assert(sql.includes('ENABLE ROW LEVEL SECURITY'), 'schema does not lock the tables')
assert(sql.includes('NEXT_PUBLIC_SUPABASE_URL'), 'schema does not name the Supabase URL variable')
const functionSource = readFileSync(join(root, 'netlify/functions/analytics.js'), 'utf8')
assert(functionSource.includes('NEXT_PUBLIC_SUPABASE_URL'), 'function does not read the Supabase URL')
assert(functionSource.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'), 'function does not read the Supabase anon key')

const findSearch = {
  tags: ['Puzzle', 'Story Rich'],
  reviewScore: 'Very Positive',
  minReviews: 11,
  maxReviews: 999,
  minDate: '2023-01-01',
  maxDate: '2023-12-31',
  reviewScoreOrBetter: true,
  hours: null,
  aiDeclaration: 'any',
  excludeTags: ['Early Access'],
  includeAdultGames: false,
  limit: 100,
  orderBy: 'reviews',
  password: 'must-not-be-stored'
}

const diiigSearch = {
  tags: ['First-Person', 'Atmospheric', 'Singleplayer'],
  minDate: '2026-01-01',
  maxDate: '2026-10-27',
  reviewScores: ['Positive', 'Very Positive', 'Overwhelmingly Positive'],
  scoreLabel: 'Positive',
  minReviews: 11,
  maxReviews: 10000000,
  reviewCountLabel: ''
}

const body = {
  user: { id: userId, locale: 'en-GB', userAgent: 'smoke-test' },
  session: {
    id: sessionId,
    startedAt,
    landingPath: '/',
    referrer: ''
  },
  events: [
    {
      occurredAt: startedAt,
      product: 'site',
      eventName: 'page_view',
      path: '/',
      properties: { name: 'Home', path: '/', query: {} }
    },
    {
      occurredAt: startedAt,
      product: 'site',
      eventName: 'click',
      path: '/',
      properties: { tag: 'a', text: 'Find a Game for Me', href: '/find' }
    },
    {
      occurredAt: startedAt,
      product: 'find_a_game',
      eventName: 'page_view',
      path: '/find',
      properties: { name: 'GameFinder', path: '/find', query: {} }
    },
    {
      occurredAt: startedAt,
      product: 'find_a_game',
      eventName: 'search',
      path: '/find',
      properties: findSearch
    },
    {
      occurredAt: startedAt,
      product: 'diiig',
      eventName: 'dig_choice',
      path: '/diiig',
      properties: { kind: 'tag', optionId: 'First-Person', label: 'First-Person', index: 0 }
    },
    {
      occurredAt: startedAt,
      product: 'diiig',
      eventName: 'search',
      path: '/diiig',
      properties: diiigSearch
    },
    {
      occurredAt: startedAt,
      product: 'diiig',
      eventName: 'dig_results',
      path: '/diiig',
      properties: {
        count: 1,
        games: [{ position: 1, name: 'Outer Wilds', appId: 753640, url: 'https://store.steampowered.com/app/753640' }]
      }
    },
    {
      occurredAt: startedAt,
      product: 'recommender',
      eventName: 'recommender_query',
      path: '/recommender',
      properties: { query: 'Hades' }
    },
    {
      occurredAt: startedAt,
      product: 'recommender',
      eventName: 'recommender_search',
      path: '/recommender',
      properties: {
        gameName: 'Hades',
        appId: 1145360,
        minCommonTags: 11,
        includeAdultGames: false
      }
    }
  ]
}

const sink = createMemorySink()
const handler = createHandler(sink)
const response = await handler({ httpMethod: 'POST', body: JSON.stringify(body) })
const result = JSON.parse(response.body)
assert(response.statusCode === 200, `expected 200, got ${response.statusCode}: ${response.body}`)
assert(result.accepted === 9, `expected 9 events, stored ${result.accepted}`)
assert(sink.users.size === 1, 'user was not stored')
assert(sink.sessions.size === 1, 'session was not stored')
assert(sink.sessions.get(sessionId).userId === userId, 'session is not tied to the user')

const find = sink.events.find((event) => event.product === 'find_a_game' && event.eventName === 'search')
const dig = sink.events.find((event) => event.product === 'diiig' && event.eventName === 'search')
assert(find && dig && find !== dig, 'Find a Game and DIIIG searches were not stored apart')
assert(find.properties.tags.join(',') === 'Puzzle,Story Rich', 'Find a Game tags were dropped')
assert(find.properties.reviewScore === 'Very Positive', 'Find a Game review score was dropped')
assert(find.properties.minDate === '2023-01-01' && find.properties.maxDate === '2023-12-31', 'Find a Game dates were dropped')
assert(find.properties.excludeTags[0] === 'Early Access', 'Find a Game exclusions were dropped')
assert(find.properties.password == null, 'a blocked field was stored')
assert(dig.properties.tags.join(',') === 'First-Person,Atmospheric,Singleplayer', 'DIIIG tags were dropped')
assert(dig.properties.scoreLabel === 'Positive', 'DIIIG score was dropped')
assert(dig.properties.minReviews === 11, 'DIIIG review floor was dropped')
const discovered = sink.events.find((event) => event.eventName === 'dig_results')
assert(discovered && discovered.product === 'diiig', 'DIIIG results were not stored')
assert(discovered.properties.count === 1, 'DIIIG result count was dropped')
assert(discovered.properties.games[0].name === 'Outer Wilds', 'DIIIG result name was dropped')
assert(discovered.properties.games[0].appId === 753640, 'DIIIG result app id was dropped')

const lookedUp = sink.events.find((event) => event.eventName === 'recommender_search')
assert(lookedUp.properties.gameName === 'Hades', 'Recommender game name was dropped')
assert(lookedUp.properties.appId === 1145360, 'Recommender app id was dropped')
assert(sink.events.some((event) => event.eventName === 'recommender_query' && event.properties.query === 'Hades'), 'typed Recommender query was dropped')
assert(sink.events.some((event) => event.eventName === 'click'), 'click was dropped')
assert(sink.events.some((event) => event.eventName === 'page_view' && event.product === 'find_a_game'), 'Find a Game page view was dropped')

const again = await handler({ httpMethod: 'POST', body: JSON.stringify(body) })
assert(JSON.parse(again.body).accepted === 9, 'a second batch was rejected')
assert(sink.users.size === 1, 'the same user was inserted twice')
assert(sink.sessions.size === 1, 'the same session was inserted twice')

const rejected = await handler({
  httpMethod: 'POST',
  body: JSON.stringify({
    ...body,
    events: [{ ...body.events[0], product: 'other' }]
  })
})
assert(rejected.statusCode === 400, 'an unknown product was accepted')

const wrongMethod = await handler({ httpMethod: 'GET', body: '' })
assert(wrongMethod.statusCode === 405, 'GET was accepted')

const calls = []
const supabase = createSupabaseSink({
  url: 'https://example.supabase.co/',
  anonKey: 'test-anon-key',
  fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return { ok: true, status: 200 }
  }
})
const supabaseHandler = createHandler(supabase)
const stored = await supabaseHandler({ httpMethod: 'POST', body: JSON.stringify(body) })
assert(stored.statusCode === 200, `supabase write failed: ${stored.body}`)
assert(calls.length === 1, 'supabase was not called once')
assert(calls[0].url === 'https://example.supabase.co/rest/v1/rpc/analytics_ingest', 'supabase endpoint is wrong')
assert(calls[0].options.headers.apikey === 'test-anon-key', 'anon key was not sent')
const sent = JSON.parse(calls[0].options.body)
assert(sent.payload.user.id === userId, 'user was not sent to Supabase')
assert(sent.payload.events.length === 9, 'events were not sent to Supabase')
assert(sent.payload.events.every((event) => event.properties.password == null), 'a blocked field was sent to Supabase')

const missing = createSupabaseSink({
  url: 'https://example.supabase.co',
  anonKey: 'test-anon-key',
  fetchImpl: async () => ({ ok: false, status: 404 })
})
const unavailable = await createHandler(missing)({ httpMethod: 'POST', body: JSON.stringify(body) })
assert(unavailable.statusCode === 503, 'a missing Supabase function was treated as stored')

const origin = 'https://gamediscoverytool.com'
const steam = linkDetails('https://store.steampowered.com/app/1145360/Hades/', origin)
assert(steam.destination === 'steam' && steam.appId === 1145360, 'a Steam link was not recognised')
const itad = linkDetails('https://isthereanydeal.com/game/hades/info/', origin)
assert(itad.destination === 'itad' && itad.gameSlug === 'hades', 'an ITAD link was not recognised')
const blogIndex = linkDetails('/blog', origin)
assert(blogIndex.destination === 'blog' && blogIndex.slug === '', 'the blog index was not recognised')
const futurePost = linkDetails('/blog/a-post-that-does-not-exist-yet', origin)
assert(futurePost.destination === 'blog' && futurePost.slug === 'a-post-that-does-not-exist-yet', 'a future blog post was not recognised')
assert(!linkDetails('https://example.com/blog/nope', origin).destination, 'an outside link was marked as a blog')

console.log(`analytics smoke test passed: 1 user, 1 session, ${sink.events.length} events`)
console.log('products:', [...new Set(sink.events.map((event) => event.product))].join(', '))
console.log('recommender game:', lookedUp.properties.gameName)
