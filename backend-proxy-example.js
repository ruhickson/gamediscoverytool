// Example Node.js/Express backend proxy
// This would run on your server to hide Cube.js credentials

const express = require('express')
const axios = require('axios')
const cors = require('cors')

const app = express()

// Environment variables (server-side only)
const CUBEJS_API_URL = process.env.CUBEJS_API_URL
const CUBEJS_AUTH_TOKEN = process.env.CUBEJS_AUTH_TOKEN

// Middleware
app.use(cors())
app.use(express.json())

// Create Cube.js client with hidden credentials
const cubeClient = axios.create({
  baseURL: CUBEJS_API_URL,
  timeout: 30000,
  headers: {
    'Authorization': CUBEJS_AUTH_TOKEN,
    'Content-Type': 'application/json'
  }
})

// Proxy endpoints
app.post('/api/search/games', async (req, res) => {
  try {
    const { query, limit = 100 } = req.body
    
    // Use client-side search engine logic here
    // Or query Cube.js directly with hidden credentials
    const response = await cubeClient.post('/cubejs-api/v1/load', {
      query: {
        dimensions: ['Games.name', 'Games.app_id'],
        filters: [
          {
            member: 'Games.name',
            operator: 'contains',
            values: [query]
          }
        ],
        limit
      }
    })
    
    res.json(response.data)
  } catch (error) {
    console.error('Search games error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
})

app.post('/api/search/similar', async (req, res) => {
  try {
    const { appId, minTags = 3 } = req.body
    
    const response = await cubeClient.post('/cubejs-api/v1/load', {
      query: {
        dimensions: ['Games.name', 'Games.app_id'],
        measures: ['Games.similarity_score'],
        filters: [
          {
            member: 'Games.app_id',
            operator: 'notEquals',
            values: [appId]
          }
        ],
        order: [['Games.similarity_score', 'desc']],
        limit: 50
      }
    })
    
    res.json(response.data)
  } catch (error) {
    console.error('Similar games error:', error)
    res.status(500).json({ error: 'Similar games search failed' })
  }
})

app.post('/api/search/tags', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body
    
    const response = await cubeClient.post('/cubejs-api/v1/load', {
      query: {
        dimensions: ['all_tags.name'],
        measures: ['all_tags.popularity'],
        filters: query ? [
          {
            member: 'all_tags.name',
            operator: 'contains',
            values: [query]
          }
        ] : [],
        order: [['all_tags.popularity', 'desc']],
        limit
      }
    })
    
    res.json(response.data)
  } catch (error) {
    console.error('Tags search error:', error)
    res.status(500).json({ error: 'Tags search failed' })
  }
})

app.post('/api/search/filtered', async (req, res) => {
  try {
    const filters = req.body
    
    // Build Cube.js query from filters
    const query = {
      dimensions: ['Games.name', 'Games.app_id', 'Games.release_date'],
      measures: ['Games.total_reviews', 'Games.score_percent'],
      order: [['Games.total_reviews', 'desc']],
      limit: 100
    }
    
    // Add filters based on request
    if (filters.tags && filters.tags.length > 0) {
      query.filters = [
        {
          member: 'GameTags.tag',
          operator: 'equals',
          values: filters.tags
        }
      ]
    }
    
    if (filters.minDate || filters.maxDate) {
      if (!query.filters) query.filters = []
      
      if (filters.minDate) {
        query.filters.push({
          member: 'Games.release_date',
          operator: 'gte',
          values: [filters.minDate]
        })
      }
      
      if (filters.maxDate) {
        query.filters.push({
          member: 'Games.release_date',
          operator: 'lte',
          values: [filters.maxDate]
        })
      }
    }
    
    const response = await cubeClient.post('/cubejs-api/v1/load', { query })
    res.json(response.data)
  } catch (error) {
    console.error('Filtered search error:', error)
    res.status(500).json({ error: 'Filtered search failed' })
  }
})

// Rate limiting middleware
const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

app.use('/api/', limiter)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`API proxy server running on port ${PORT}`)
})
