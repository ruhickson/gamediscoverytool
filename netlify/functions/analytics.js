const { createHandler, createPgSink } = require('./analytics-store')

let sinkPromise = null

function databaseUrl() {
  return process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL || ''
}

function getSink() {
  const url = databaseUrl()
  if (!url) return null
  if (!sinkPromise) sinkPromise = Promise.resolve(createPgSink(url))
  return sinkPromise
}

exports.handler = async function handler(event) {
  const sink = await getSink()
  if (!sink) {
    return {
      statusCode: 503,
      body: JSON.stringify({ ok: false, error: 'Analytics database is not configured' })
    }
  }
  return createHandler(sink)(event)
}
