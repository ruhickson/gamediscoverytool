// Netlify Function: ITAD price lookup with API key authentication
const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Try to load .env file if running locally (Netlify Dev doesn't always load .env automatically)
// Try multiple possible paths for .env file
const possibleEnvPaths = [
  path.join(__dirname, '../../.env'),  // From netlify/functions/ to root
  path.join(__dirname, '../.env'),     // From netlify/functions/ to netlify/
  path.join(process.cwd(), '.env')      // From current working directory
]

if (process.env.NETLIFY_DEV || !process.env.ITAD_SECRET) {
  let envLoaded = false
  for (const envPath of possibleEnvPaths) {
    try {
      if (fs.existsSync(envPath)) {
        console.log(`Trying to load .env from: ${envPath}`)
        const envContent = fs.readFileSync(envPath, 'utf8')
        const envLines = envContent.split(/\r?\n/)
        for (const line of envLines) {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) continue
          const match = line.match(/^([^#=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["']|["']$/g, '')
            if (!process.env[key]) {
              process.env[key] = value
              console.log(`Loaded env var: ${key}`)
            }
          }
        }
        console.log(`Successfully loaded .env file from: ${envPath}`)
        envLoaded = true
        break
      }
    } catch (e) {
      console.warn(`Could not load .env file from ${envPath}:`, e.message)
    }
  }
  if (!envLoaded) {
    console.warn('Could not find .env file in any of the expected locations')
  }
}

// Get API key from environment (support multiple variable names)
function getApiKey() {
  const candidates = [
    process.env.ITAD_SECRET, // prefer secret
    process.env.ITAD_ID,
    process.env.ITAD_API_KEY,
    process.env.VITE_ITAD_SECRET, // in case someone used Vite prefix
    process.env.VITE_ITAD_ID
  ]
  const apiKey = candidates.find(Boolean)
  if (!apiKey) {
    const availableEnv = Object.keys(process.env)
      .filter((k) => k.toUpperCase().includes('ITAD'))
      .reduce((acc, k) => ({ ...acc, [k]: '[set]'}), {})
    const message = `Missing ITAD API key. Set ITAD_SECRET or ITAD_ID in your environment. Present keys: ${JSON.stringify(availableEnv)}`
    const err = new Error(message)
    err.statusCode = 500
    throw err
  }
  return apiKey
}

// Get ITAD_SECRET specifically (required for prices endpoint)
function getItadSecret() {
  const candidates = [
    process.env.ITAD_SECRET,
    process.env.VITE_ITAD_SECRET
  ]
  const secret = candidates.find(Boolean)
  if (!secret) {
    const availableEnv = Object.keys(process.env)
      .filter((k) => k.toUpperCase().includes('ITAD'))
      .reduce((acc, k) => ({ ...acc, [k]: '[set]'}), {})
    const message = `Missing ITAD_SECRET. Prices endpoint requires ITAD_SECRET. Present keys: ${JSON.stringify(availableEnv)}`
    const err = new Error(message)
    err.statusCode = 500
    throw err
  }
  return secret
}

// Lookup game ID from title using /lookup/id/title/v1 (no trailing slash)
async function lookupGameId(gameName, apiKey) {
  try {
    const response = await axios.post(
      'https://api.isthereanydeal.com/lookup/id/title/v1', // No trailing slash!
      [gameName], // Body should be an array of game titles
      {
        headers: {
          'key': apiKey, // API key as header
          'Content-Type': 'application/json' // Content-Type header
        },
        timeout: 10000
      }
    )

    // Response format: {"Game Name": "game-id-plain"} or {"data": {"Game Name": {"id": "game-id-plain"}}}
    if (response.data[gameName]) {
      // Direct format: {"Game Name": "game-id-plain"}
      return response.data[gameName]
    } else if (response.data.data?.[gameName]) {
      // Nested format: {"data": {"Game Name": {"id": "game-id-plain"}}}
      const gameData = response.data.data[gameName]
      return gameData.id || gameData
    }
    
    return null
  } catch (error) {
    console.error(`Error looking up game ID for "${gameName}":`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    })
    return null
  }
}

// Get prices for game ID using /games/prices/v3
// Note: This endpoint requires ITAD_SECRET as query parameter "key"
async function getGamePrices(gameId, itadSecret, country = 'US') {
  if (!gameId) {
    return null
  }

  try {
    // Key should be in query parameter, not header or body
    const url = `https://api.isthereanydeal.com/games/prices/v3?key=${encodeURIComponent(itadSecret)}&country=${country.toLowerCase()}`
    
    const response = await axios.post(
      url,
      [gameId], // Body should be array of game IDs (UUIDs)
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )

    // Response is an array of price objects: [{ id: "game-id", deals: [...], historyLow: {...} }, ...]
    const priceData = Array.isArray(response.data) 
      ? response.data.find(item => item.id === gameId)
      : response.data.data?.[gameId]
    
    return priceData || null
  } catch (error) {
    console.error(`Error getting prices for game ID "${gameId}":`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    })
    return null
  }
}

// Main handler function
async function handlerFunction(event, context) {
  // Wrap everything in try-catch to ensure JSON error responses
  try {
    console.log('=== ITAD PRICE FUNCTION CALLED ===')
    console.log('Method:', event.httpMethod)
    console.log('Body:', event.body)
    console.log('Environment check - ITAD_SECRET:', process.env.ITAD_SECRET ? 'Found (length: ' + process.env.ITAD_SECRET.length + ')' : 'Not found')
    console.log('Environment check - ITAD_ID:', process.env.ITAD_ID ? 'Found (length: ' + process.env.ITAD_ID.length + ')' : 'Not found')
    
    // Get game names from query or body
    let gameNames = []
    let countryFromBody = undefined
    
    if (event.httpMethod === 'GET') {
      const names = event.queryStringParameters?.games
      if (names) {
        gameNames = Array.isArray(names) ? names : [names]
      }
    } else if (event.httpMethod === 'POST') {
      let body
      try {
        body = JSON.parse(event.body || '{}')
        console.log('Request body parsed:', JSON.stringify(body))
      } catch (e) {
        console.error('Failed to parse JSON body:', e.message)
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON body', details: e.message })
        }
      }
      gameNames = body.games || []
      countryFromBody = body.country
    }

    console.log('Game names to lookup:', gameNames)

    if (!gameNames || gameNames.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameter: games (array of game names)' })
      }
    }

    // Limit to 50 games per request to avoid overwhelming the API
    if (gameNames.length > 50) {
      gameNames = gameNames.slice(0, 50)
    }

    // Get API keys
    let apiKey
    let itadSecret
    try {
      apiKey = getApiKey() // For lookup endpoint
      itadSecret = getItadSecret() // For prices endpoint (requires ITAD_SECRET)
      console.log('API key found:', apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No')
      console.log('ITAD_SECRET found:', itadSecret ? 'Yes (length: ' + itadSecret.length + ')' : 'No')
    } catch (keyError) {
      console.error('API key error:', keyError.message)
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: keyError.message })
      }
    }

    // Process each game individually - one API call per game
    const country = (event.queryStringParameters?.country || countryFromBody || 'US')
    const results = {}
    
    console.log('Processing', gameNames.length, 'games individually')
    
    // Process games sequentially to avoid rate limiting
    for (const gameName of gameNames) {
      try {
        // Step 1: Lookup game ID from title (one API call)
        console.log(`Looking up game ID for: ${gameName}`)
        const gameId = await lookupGameId(gameName, apiKey)
        
        if (!gameId) {
          // Game not found
          results[gameName] = {
            id: null,
            price: null,
            url: null
          }
          continue
        }
        
        // Step 2: Get prices for this game ID (one API call)
        // Note: Prices endpoint requires ITAD_SECRET specifically
        console.log(`Getting prices for game ID: ${gameId}`)
        const priceData = await getGamePrices(gameId, itadSecret, country)
        
        if (priceData && priceData.deals && Array.isArray(priceData.deals) && priceData.deals.length > 0) {
          // Find the lowest current price
          // ITAD API returns price.amount as a number (e.g., 44.95), not cents
          const sortedPrices = [...priceData.deals].sort((a, b) => {
            // Use amountInt (in cents) if available, otherwise use amount (in dollars)
            const priceA = a.price?.amountInt || (a.price?.amount || 0) * 100
            const priceB = b.price?.amountInt || (b.price?.amount || 0) * 100
            return priceA - priceB
          })
          const lowestPrice = sortedPrices[0]
          
          // Extract price - amount is already in dollars (e.g., 44.95), amountInt is in cents (e.g., 4495)
          const priceAmount = lowestPrice.price?.amount || (lowestPrice.price?.amountInt || 0) / 100
          const priceAmountInt = lowestPrice.price?.amountInt || (lowestPrice.price?.amount || 0) * 100
          
          console.log(`Price data for ${gameName}:`, {
            amount: priceAmount,
            amountInt: priceAmountInt,
            currency: lowestPrice.price?.currency,
            shop: lowestPrice.shop?.name,
            url: lowestPrice.url
          })
          
          results[gameName] = {
            id: gameId,
            price: {
              amount: priceAmount,
              amountInt: priceAmountInt,
              currency: lowestPrice.price?.currency || 'USD',
              shop: lowestPrice.shop?.name || 'Unknown',
              url: lowestPrice.url || `https://isthereanydeal.com/game/${gameId}/info/`
            },
            url: `https://isthereanydeal.com/game/${gameId}/info/`
          }
        } else {
          // Game found but no price data
          console.log(`No price data found for ${gameName} (gameId: ${gameId})`)
          results[gameName] = {
            id: gameId,
            price: null,
            url: `https://isthereanydeal.com/game/${gameId}/info/`
          }
        }
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error processing game "${gameName}":`, error.message)
        results[gameName] = {
          id: null,
          price: null,
          url: null
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify({ data: results })
    }
  } catch (error) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      status: error.statusCode || error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack ? error.stack.split('\n').slice(0, 10).join('\n') : 'No stack trace'
    }
    
    console.error('ITAD price function error:', errorDetails)
    console.error('Full error:', error)
    
    const status = error.statusCode || error.response?.status || 500
    const errorData = {
      error: error.message || 'Failed to fetch ITAD prices',
      status: status,
      details: error.response?.data || errorDetails,
      timestamp: new Date().toISOString(),
      stack: errorDetails.stack
    }
    
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData, null, 2)
    }
  }
}

// Export handler with outer try-catch to catch any initialization errors
exports.handler = async function(event, context) {
  console.log('=== HANDLER CALLED ===')
  console.log('Event:', JSON.stringify(event, null, 2))
  try {
    const result = await handlerFunction(event, context)
    console.log('Handler result:', JSON.stringify(result, null, 2))
    return result
  } catch (error) {
    console.error('=== UNCAUGHT ERROR IN HANDLER ===')
    console.error('Error:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        type: error.name || 'Error',
        stack: error.stack ? error.stack.split('\n').slice(0, 10).join('\n') : 'No stack trace'
      }, null, 2)
    }
  }
}


