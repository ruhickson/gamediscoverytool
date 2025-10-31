// Netlify Function: ITAD info proxy to avoid CORS in the browser
const axios = require('axios')

exports.handler = async function(event) {
  try {
    const game = (event.queryStringParameters && event.queryStringParameters.game) || ''
    if (!game) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required query parameter: game' })
      }
    }

    const apiUrl = `https://isthereanydeal.com/api/game/info/?game=${encodeURIComponent(game)}`

    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    })

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


