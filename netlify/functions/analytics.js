const { createHandler, createPgSink, createSupabaseSink } = require('./analytics-store')

let sinkPromise = null

function databaseUrl() {
  return process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL || ''
}

function supabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

function getSink() {
  const supabase = supabaseConfig()
  if (supabase) {
    if (!sinkPromise) sinkPromise = Promise.resolve(createSupabaseSink(supabase))
    return sinkPromise
  }
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
