// Netlify Function: ITAD prices lookup by game ID
const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Load .env file if needed
if (process.env.NETLIFY_DEV || !process.env.ITAD_SECRET) {
  const possibleEnvPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env')
  ]
  
  for (const envPath of possibleEnvPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8')
        const envLines = envContent.split(/\r?\n/)
        for (const line of envLines) {
          if (line.trim().startsWith('#') || !line.trim()) continue
          const match = line.match(/^([^#=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["']|["']$/g, '')
            if (!process.env[key]) {
              process.env[key] = value
            }
          }
        }
        break
      }
    } catch (e) {
      // Ignore
    }
  }
}

exports.handler = async function(event, context) {
  console.log('=== ITAD PRICES FUNCTION CALLED ===')
  try {
    console.log('Event body:', event.body)
    const body = JSON.parse(event.body || '{}')
    const gameId = body.id
    const country = body.country || 'us'
    console.log('Game ID:', gameId)
    
    if (!gameId) {
      console.log('Missing game ID')
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing game ID' })
      }
    }
    
    // Get ITAD_SECRET (required for prices endpoint)
    const itadSecret = process.env.ITAD_SECRET
    console.log('ITAD_SECRET found:', itadSecret ? 'Yes (length: ' + itadSecret.length + ')' : 'No')
    if (!itadSecret) {
      console.log('Missing ITAD_SECRET')
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing ITAD_SECRET. Check .env file.' })
      }
    }
    
    // Call ITAD prices endpoint
    const url = `https://api.isthereanydeal.com/games/prices/v3?key=${encodeURIComponent(itadSecret)}&country=${country}`
    const response = await axios.post(
      url,
      [gameId], // Body is array of game IDs
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )
    
    // Response is an array: [{ id: "game-id", deals: [...], historyLow: {...} }, ...]
    const priceData = Array.isArray(response.data) 
      ? response.data.find(item => item.id === gameId)
      : null
    
    if (priceData && priceData.deals && Array.isArray(priceData.deals) && priceData.deals.length > 0) {
      // Find the lowest current price
      const sortedPrices = [...priceData.deals].sort((a, b) => {
        const priceA = a.price?.amountInt || (a.price?.amount || 0) * 100
        const priceB = b.price?.amountInt || (b.price?.amount || 0) * 100
        return priceA - priceB
      })
      const lowestPrice = sortedPrices[0]
      
      // Extract price - amount is already in dollars (e.g., 44.95), amountInt is in cents (e.g., 4495)
      const priceAmount = lowestPrice.price?.amount || (lowestPrice.price?.amountInt || 0) / 100
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: {
            amount: priceAmount,
            amountInt: lowestPrice.price?.amountInt || priceAmount * 100,
            currency: lowestPrice.price?.currency || 'USD',
            shop: lowestPrice.shop?.name || 'Unknown',
            url: lowestPrice.url || `https://isthereanydeal.com/game/${gameId}/info/`
          }
        })
      }
    }
    
    // No price data found
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: null })
    }
  } catch (error) {
    console.error('ITAD prices error:', error.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message || 'Failed to fetch prices',
        price: null
      })
    }
  }
}

