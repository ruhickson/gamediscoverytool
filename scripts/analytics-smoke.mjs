import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { createMemorySink, createHandler } = require(join(root, 'netlify/functions/analytics-store.js'))

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
assert(result.accepted === 8, `expected 8 events, stored ${result.accepted}`)
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

const lookedUp = sink.events.find((event) => event.eventName === 'recommender_search')
assert(lookedUp.properties.gameName === 'Hades', 'Recommender game name was dropped')
assert(lookedUp.properties.appId === 1145360, 'Recommender app id was dropped')
assert(sink.events.some((event) => event.eventName === 'recommender_query' && event.properties.query === 'Hades'), 'typed Recommender query was dropped')
assert(sink.events.some((event) => event.eventName === 'click'), 'click was dropped')
assert(sink.events.some((event) => event.eventName === 'page_view' && event.product === 'find_a_game'), 'Find a Game page view was dropped')

const again = await handler({ httpMethod: 'POST', body: JSON.stringify(body) })
assert(JSON.parse(again.body).accepted === 8, 'a second batch was rejected')
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

console.log(`analytics smoke test passed: 1 user, 1 session, ${sink.events.length} events`)
console.log('products:', [...new Set(sink.events.map((event) => event.product))].join(', '))
console.log('recommender game:', lookedUp.properties.gameName)
