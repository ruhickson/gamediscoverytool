// Netlify Function: ITAD game ID lookup
const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Load .env file if needed
if (process.env.NETLIFY_DEV || !process.env.ITAD_ID) {
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
  console.log('=== ITAD LOOKUP FUNCTION CALLED ===')
  try {
    console.log('Event body:', event.body)
    const body = JSON.parse(event.body || '{}')
    const gameName = body.game
    console.log('Game name:', gameName)
    
    if (!gameName) {
      console.log('Missing game name')
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing game name' })
      }
    }
    
    // Get API key (ITAD_ID for lookup endpoint)
    const apiKey = process.env.ITAD_SECRET || process.env.ITAD_ID
    console.log('API key found:', apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No')
    if (!apiKey) {
      console.log('Missing API key')
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing ITAD API key. Check .env file.' })
      }
    }
    
    // Call ITAD lookup endpoint
    const response = await axios.post(
      'https://api.isthereanydeal.com/lookup/id/title/v1',
      [gameName],
      {
        headers: {
          'key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )
    
    // Response format: {"Game Name": "game-id-plain"}
    const gameId = response.data[gameName] || null
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: gameId })
    }
  } catch (error) {
    console.error('=== ITAD LOOKUP ERROR ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error response:', error.response?.data)
    console.error('Error status:', error.response?.status)
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message || 'Failed to lookup game ID',
        details: error.response?.data || error.stack,
        id: null
      })
    }
  }
}

