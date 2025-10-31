// Netlify Function: Steam appdetails proxy to avoid CORS
const axios = require('axios')

exports.handler = async function(event) {
  try {
    const appids = event.queryStringParameters?.appids
    const cc = event.queryStringParameters?.cc || process.env.STEAM_CC || 'us'
    const lang = event.queryStringParameters?.l || 'en'

    if (!appids) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing appids' }) }
    }

    const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appids)}&cc=${encodeURIComponent(cc)}&l=${encodeURIComponent(lang)}`

    // Use a desktop User-Agent to reduce chance of blocked responses
    const headers = {
      'User-Agent': process.env.STEAM_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9'
    }

    let response
    try {
      response = await axios.get(url, { timeout: 10000, headers })
    } catch (err) {
      if (err.response?.status === 429) {
        // brief backoff and retry once
        await new Promise(r => setTimeout(r, 2000))
        response = await axios.get(url, { timeout: 10000, headers })
      } else {
        throw err
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(response.data)
    }
  } catch (error) {
    const status = error.response?.status || 500
    const message = error.response?.data || { error: error.message || 'Upstream request failed' }
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json' },
      body: typeof message === 'string' ? message : JSON.stringify(message)
    }
  }
}



