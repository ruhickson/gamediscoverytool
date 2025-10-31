import axios from 'axios'
import { searchGames, getSearchSuggestions, preloadIndex } from './searchEngine.js'
import { searchTags, getTagSuggestions, preloadIndex as preloadTagsIndex } from './tagsSearchEngine.js'

// Cube.js API configuration
const CUBEJS_API_URL = import.meta.env.VITE_CUBEJS_API_URL || ''
const CUBEJS_AUTH_TOKEN = import.meta.env.VITE_CUBEJS_AUTH_TOKEN || ''

// Create axios instance with default configuration
const cubeApi = axios.create({
  baseURL: CUBEJS_API_URL,
  timeout: 30000,
  headers: {
    'Authorization': CUBEJS_AUTH_TOKEN,
    'Content-Type': 'application/json'
  }
})

// ------------------------------------------------------------
// In-memory LRU cache (with TTL) for name search results
// ------------------------------------------------------------
const NAME_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const NAME_CACHE_MAX_ENTRIES = 200
const nameSearchCache = new Map() // key -> { ts, results }

function normalizeSearchTerm(term) {
  return (term || '').toLowerCase().trim()
}

function makeNameCacheKey(searchTerm, limit) {
  return `${normalizeSearchTerm(searchTerm)}::${limit || 100}`
}

function getFromNameCache(searchTerm, limit) {
  const key = makeNameCacheKey(searchTerm, limit)
  if (!nameSearchCache.has(key)) return null
  const entry = nameSearchCache.get(key)
  const isFresh = Date.now() - entry.ts < NAME_CACHE_TTL_MS
  if (!isFresh) {
    nameSearchCache.delete(key)
    return null
  }
  // touch for LRU: reinsert to move to end
  nameSearchCache.delete(key)
  nameSearchCache.set(key, entry)
  return entry.results
}

function setNameCache(searchTerm, limit, results) {
  const key = makeNameCacheKey(searchTerm, limit)
  nameSearchCache.set(key, { ts: Date.now(), results })
  if (nameSearchCache.size > NAME_CACHE_MAX_ENTRIES) {
    const oldestKey = nameSearchCache.keys().next().value
    if (oldestKey) nameSearchCache.delete(oldestKey)
  }
}

// ------------------------------------------------------------
// LocalStorage warm cache for names/appIds (daily refresh)
// ------------------------------------------------------------
const LS_WARM_NAMES_KEY = 'gd_name_index_v1'
const LS_DAILY_CACHE_KEY = 'gd_daily_cache_v1'
const DAILY_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const LS_WARM_NAMES_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
let warmNamesMemory = null // [{ name, appId }]

function readWarmNamesFromStorage() {
  try {
    const raw = localStorage.getItem(LS_WARM_NAMES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.data)) return null
    const isFresh = Date.now() - (parsed.ts || 0) < LS_WARM_NAMES_TTL_MS
    return isFresh ? parsed.data : null
  } catch (_) {
    return null
  }
}

function writeWarmNamesToStorage(data) {
  try {
    localStorage.setItem(LS_WARM_NAMES_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch (_) {
    // ignore quota errors
  }
}

export async function prefetchWarmNames(limit = 10000) {
  try {
    // Preload the search index for instant searches
    await preloadIndex()
    console.log('Search index preloaded successfully')
    return []
  } catch (error) {
    console.warn('Search index preload failed:', error)
    return []
  }
}

export async function filterWarmNames(searchTerm, limit = 50) {
  try {
    // Use the new search engine for instant results
    const results = await getSearchSuggestions(searchTerm, limit)
    return results
  } catch (error) {
    console.error('Error filtering warm names:', error)
    return []
  }
}

// Review score order for proper sorting
const reviewDescOrder = [
  'Overwhelmingly Positive', 'Very Positive', 'Mostly Positive', 'Positive',
  'Mixed',
  'Negative', 'Mostly Negative', 'Very Negative', 'Overwhelmingly Negative'
]

// Helper function to make Cube.js API calls with retry logic
async function queryCube(query, maxRetries = 3, baseDelay = 1) {
  const queryJson = JSON.stringify(query)
  const queryParam = encodeURIComponent(queryJson)
  const url = `/load?query=${queryParam}`
  
  console.log('Cube.js Query:', query)
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await cubeApi.get(url)
      
      if (response.data.error) {
        const errorMsg = response.data.error
        
        // Check if it's a timeout-related error
        if (errorMsg.toLowerCase().includes('timeout') || 
            errorMsg.toLowerCase().includes('continue wait')) {
          if (attempt <= maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random()
            console.log(`Cube.js timeout error. Retrying in ${delay.toFixed(2)} seconds... (Attempt ${attempt} of ${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay * 1000))
            continue
          } else {
            throw new Error(`Cube.js returned an error after ${maxRetries} retries: ${errorMsg}`)
          }
        } else {
          throw new Error(`Cube.js returned an error: ${errorMsg}`)
        }
      }
      
      if (response.data.data) {
        console.log('Cube.js Response:', response.data.data)
        return response.data.data
      } else {
        throw new Error(`No 'data' field in response. Response structure: ${Object.keys(response.data).join(', ')}`)
      }
      
    } catch (error) {
      // Handle network-level errors
      if (error.message.toLowerCase().includes('timeout') || 
          error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('connection')) {
        if (attempt <= maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random()
          console.log(`Network error detected. Retrying in ${delay.toFixed(2)} seconds... (Attempt ${attempt} of ${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay * 1000))
          continue
        } else {
          throw new Error(`Network error after ${maxRetries} retries: ${error.message}`)
        }
      } else {
        throw error
      }
    }
  }
}

// Helper function to standardize column names
function standardizeColumnNames(result, expectedNames) {
  const standardized = { ...result }
  
  expectedNames.forEach(expectedName => {
    if (!(expectedName in standardized)) {
      // Try different variations of the column name
      const baseName = expectedName.replace(/^[^.]+\./, '') // Remove prefix like "Games."
      
      if (baseName in standardized) {
        standardized[expectedName] = standardized[baseName]
        delete standardized[baseName]
      } else {
        // Try to find numeric columns if this is a measure
        if (/count|reviews|score|metacritic|recommendations/i.test(expectedName)) {
          const numericCols = Object.keys(standardized).filter(key => 
            typeof standardized[key] === 'number'
          )
          if (numericCols.length > 0) {
            const firstNumericCol = numericCols[0]
            standardized[expectedName] = standardized[firstNumericCol]
            delete standardized[firstNumericCol]
          }
        }
      }
    }
  })
  
  return standardized
}

// Helper function to ensure numeric columns
function ensureNumeric(data, columns) {
  const result = [...data]
  
  columns.forEach(col => {
    if (col in result[0] && typeof result[0][col] !== 'number') {
      result.forEach(row => {
        if (row[col] !== null && row[col] !== undefined) {
          row[col] = parseFloat(String(row[col]).replace(/,/g, '')) || 0
        }
      })
    }
  })
  
  return result
}

// Client-side tags search (no database queries)
export async function getAllTags() {
  try {
    // Use the new client-side search engine
    const results = await searchTags('', { limit: 1000 }) // Get all tags when no query
    
    // Map to expected format for compatibility
    return results.map(tag => ({
      'all_tags.name': tag.name,
      'all_tags.popularity': 0 // Placeholder since we don't have popularity in the new system
    }))
  } catch (error) {
    console.error('Error searching tags:', error)
    // Return empty array as fallback
    return []
  }
}

// Search tags by name (for autocomplete)
export async function searchTagsByName(query, limit = 100) {
  try {
    // Use the new client-side search engine
    const results = await searchTags(query, { limit })
    
    // Return just the tag names for compatibility
    return results.map(tag => tag.name)
  } catch (error) {
    console.error('Error searching tags:', error)
    // Return empty array as fallback
    return []
  }
}

// Get recent top games for initial load
export async function getRecentTopGames(limit = 100) {
  try {
    // First try the materialized view/relation (Cube: RecentTopGames)
    const query = {
      measures: [
        'RecentTopGames.totalPositiveReviews',
        'RecentTopGames.totalNegativeReviews',
        'RecentTopGames.totalReviews'
      ],
      dimensions: [
        'RecentTopGames.name',
        'RecentTopGames.appId',
        'RecentTopGames.reviewScoreDesc',
        'RecentTopGames.releaseDate'
      ],
      order: [['RecentTopGames.totalReviews', 'desc']],
      limit
    }
    
    const result = await queryCube(query)
    
    if (Array.isArray(result) && result.length > 0) {
      // Standardize to Games.* column names
      const standardized = result.map(row => {
        const newRow = { ...row }
        const renameMap = {
          'RecentTopGames.name': 'Games.name',
          'RecentTopGames.appId': 'Games.appId',
          'RecentTopGames.reviewScoreDesc': 'Games.reviewScoreDesc',
          'RecentTopGames.releaseDate': 'Games.releaseDate',
          'RecentTopGames.totalReviews': 'Games.totalReviewsValue',
          'RecentTopGames.totalPositiveReviews': 'Games.totalPositiveReviews',
          'RecentTopGames.totalNegativeReviews': 'Games.totalNegativeReviews'
        }
        
        Object.entries(renameMap).forEach(([oldKey, newKey]) => {
          if (oldKey in newRow) {
            newRow[newKey] = newRow[oldKey]
            delete newRow[oldKey]
          }
        })
        
        return newRow
      })
      
      return ensureNumeric(standardized, ['Games.totalReviewsValue', 'Games.totalPositiveReviews', 'Games.totalNegativeReviews'])
    }
    
    return []
  } catch (error) {
    console.log('Recent top games materialized view failed, falling back to regular search:', error.message)
    
    // Fallback: use updated defaults ordered by total reviews
    try {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      
      const fallbackResult = await findGames({
        tags: null,
        reviewScore: 'Positive',
        minReviews: 11,
        maxReviews: 10000,
        minDate: twoWeeksAgo.toISOString().split('T')[0],
        maxDate: new Date().toISOString().split('T')[0],
        limit: limit,
        reviewScoreOrBetter: true
      })
      
      console.log('Fallback search returned', fallbackResult.length, 'games')
      return fallbackResult
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError)
      throw fallbackError
    }
  }
}

// Find games with filters
export async function findGames({
  tags = null,
  reviewScore = 'Any',
  minReviews = 0,
  maxReviews = 1000000,
  minDate = null,
  maxDate = null,
  limit = null,
  reviewScoreOrBetter = true,
  hours = null // { comparator: 'at_least' | 'at_most', value: number } | null
}) {
  try {
    const filters = [
      { member: 'Games.type', operator: 'equals', values: ['game'] }
    ]

    // Tag intersection logic
    if (tags && tags.length > 0) {
      if (tags.length === 1) {
        filters.push({ member: 'GameTags.tag', operator: 'equals', values: [tags[0]] })
      } else {
        // For multiple tags, run separate queries and find intersection
        // NOTE: Do NOT pass limit here - it will be applied after finding intersection
        const intersectionResult = await findGamesWithMultipleTags({
          tags,
          reviewScore,
          minReviews,
          maxReviews,
          minDate,
          maxDate,
          limit: null, // Don't limit individual tag queries
          reviewScoreOrBetter,
          hours
        })
        
        // Apply limit AFTER finding the intersection
        if (limit !== null && intersectionResult.length > limit) {
          return intersectionResult.slice(0, limit)
        }
        
        return intersectionResult
      }
    }

    // Review score filter
    if (reviewScore !== 'Any') {
      if (reviewScoreOrBetter) {
        const idx = reviewDescOrder.indexOf(reviewScore)
        if (idx !== -1) {
          const betterScores = reviewDescOrder.slice(0, idx + 1)
          filters.push({ member: 'Games.reviewScoreDesc', operator: 'in', values: betterScores })
        } else {
          filters.push({ member: 'Games.reviewScoreDesc', operator: 'equals', values: [reviewScore] })
        }
      } else {
        filters.push({ member: 'Games.reviewScoreDesc', operator: 'equals', values: [reviewScore] })
      }
    }

    // Review count filters
    if (minReviews > 0) {
      filters.push({ member: 'Games.totalReviewsValue', operator: 'gte', values: [Number(minReviews)] })
    }
    if (maxReviews < 1000000) {
      filters.push({ member: 'Games.totalReviewsValue', operator: 'lte', values: [Number(maxReviews)] })
    }

    // Hours filter
    if (hours && typeof hours.value === 'number' && !Number.isNaN(hours.value)) {
      const op = hours.comparator === 'at_most' ? 'lte' : 'gte'
      filters.push({ member: 'Games.hours', operator: op, values: [hours.value] })
    }

    // Handle date range
    const timeDimensions = []
    if (minDate && maxDate) {
      timeDimensions.push({
        dimension: 'Games.releaseDate',
        dateRange: [minDate, maxDate]
      })
    }

    // Construct the final query
    const query = {
      measures: ['Games.totalPositiveReviews', 'Games.totalNegativeReviews', 'Games.hours'],
      dimensions: [
        'Games.name',
        'Games.reviewScoreDesc',
        'Games.releaseDate',
        'Games.appId',
        'Games.totalReviewsValue'
      ],
      filters,
      order: [['Games.releaseDate', 'desc']]
    }

    // Add timeDimensions only if not empty
    if (timeDimensions.length > 0) {
      query.timeDimensions = timeDimensions
    }

    // Add limit only if specified
    if (limit !== null) {
      query.limit = limit
    }

    console.log('Cube.js Query Sent:', query)
    console.log('Query filters:', query.filters)
    query.filters.forEach((filter, idx) => {
      console.log(`  Filter ${idx}:`, JSON.stringify(filter, null, 2))
    })
    console.log('Query timeDimensions:', query.timeDimensions)
    query.timeDimensions.forEach((td, idx) => {
      console.log(`  TimeDimension ${idx}:`, JSON.stringify(td, null, 2))
    })

    // Execute the query with error handling
    let result
    try {
      result = await queryCube(query)
    } catch (error) {
      console.log('Initial query failed:', error.message)
      
      // Try a simplified version without the new measures
      console.log('Trying simplified query without positive/negative review measures...')
      
      const simplifiedQuery = {
        measures: [],
        dimensions: [
          'Games.name',
          'Games.reviewScoreDesc',
          'Games.releaseDate',
          'Games.appId',
          'Games.totalReviewsValue'
        ],
        filters,
        order: [['Games.releaseDate', 'desc']]
      }
      
      if (timeDimensions.length > 0) {
        simplifiedQuery.timeDimensions = timeDimensions
      }
      
      console.log('Simplified Cube.js Query:', simplifiedQuery)
      
      try {
        result = await queryCube(simplifiedQuery)
      } catch (error2) {
        console.log('Even simplified query failed, trying most basic version...')
        
        const basicQuery = {
          measures: [],
          dimensions: [
            'Games.name',
            'Games.reviewScoreDesc',
            'Games.releaseDate',
            'Games.appId',
            'Games.totalReviewsValue'
          ],
          filters: [{ member: 'Games.type', operator: 'equals', values: ['game'] }],
          order: [['Games.releaseDate', 'desc']]
        }
        
        console.log('Most Basic Cube.js Query:', basicQuery)
        result = await queryCube(basicQuery)
      }
    }

    // Process and return results
    if (Array.isArray(result) && result.length > 0) {
      const standardized = result.map(row => 
        standardizeColumnNames(row, [
          'Games.totalReviewsValue',
          'Games.name',
          'Games.reviewScoreDesc',
          'Games.releaseDate',
          'Games.appId',
          'Games.totalPositiveReviews',
          'Games.totalNegativeReviews',
          'Games.hours'
        ])
      )
      
      const numeric = ensureNumeric(standardized, [
        'Games.totalReviewsValue',
        'Games.totalPositiveReviews',
        'Games.totalNegativeReviews',
        'Games.hours'
      ])
      
      // Convert releaseDate to Date and sort
      const processed = numeric.map(row => ({
        ...row,
        'Games.releaseDate': row['Games.releaseDate'] ? new Date(row['Games.releaseDate']) : null
      }))
      
      // Sort by release date (desc), nulls last, then by total reviews, then by name
      return processed.sort((a, b) => {
        // Handle null dates
        const dateA = a['Games.releaseDate']
        const dateB = b['Games.releaseDate']
        
        if (dateA && !dateB) return -1
        if (!dateA && dateB) return 1
        if (!dateA && !dateB) return 0
        
        // Compare dates
        const dateCompare = dateB - dateA
        if (dateCompare !== 0) return dateCompare
        
        // Compare total reviews
        const reviewsA = a['Games.totalReviewsValue'] || 0
        const reviewsB = b['Games.totalReviewsValue'] || 0
        const reviewsCompare = reviewsB - reviewsA
        if (reviewsCompare !== 0) return reviewsCompare
        
        // Compare names
        return (a['Games.name'] || '').localeCompare(b['Games.name'] || '')
      })
    } else {
      // Return empty array with correct structure
      return []
    }
  } catch (error) {
    console.error('Error finding games:', error)
    throw error
  }
}

// Find games with multiple tags by running separate queries and joining results
// NOTE: limit parameter is intentionally NOT used in individual tag queries
// It should be applied AFTER finding the intersection
async function findGamesWithMultipleTags({
  tags,
  reviewScore,
  minReviews,
  maxReviews,
  minDate,
  maxDate,
  limit, // This parameter is ignored - limit should be applied after intersection
  reviewScoreOrBetter,
  hours
}) {
  console.log('Multi-Tag Search Debug')
  console.log('Tags:', tags.join(', '))
  console.log('Review Score:', reviewScore)
  console.log('Date Range:', minDate, 'to', maxDate)
  console.log('Note: Not applying limit to individual tag queries - will apply after intersection')

  // Get results for each tag and find intersection
  const tagResults = []

  for (let i = 0; i < tags.length; i++) {
    console.log(`Querying tag ${i + 1}:`, tags[i])
    // Don't pass limit to individual tag queries
    const tagResult = await findGamesSingleTag({
      tag: tags[i],
      reviewScore,
      minReviews,
      maxReviews,
      minDate,
      maxDate,
      limit: null, // Explicitly set to null to get all matching games
      reviewScoreOrBetter,
      hours
    })

    console.log(`Tag ${tags[i]} returned ${tagResult.length} games`)

    if (!Array.isArray(tagResult) || tagResult.length === 0) {
      console.log(`No games found for tag: ${tags[i]} - returning empty result`)
      return []
    }

    tagResults.push(tagResult)
  }

  // Find intersection of all app IDs
  const appIdSets = tagResults.map(result => result.map(row => row['Games.appId']))
  console.log('App ID counts:', appIdSets.map(set => set.length))

  let intersectingAppIds = appIdSets[0]
  for (let i = 1; i < appIdSets.length; i++) {
    intersectingAppIds = intersectingAppIds.filter(id => appIdSets[i].includes(id))
  }

  console.log('Intersecting app IDs:', intersectingAppIds.length)

  if (intersectingAppIds.length === 0) {
    console.log('No intersection found between tags')
    return []
  }

  // Get the full game data for the intersecting app IDs
  const baseResult = tagResults[0]
  const finalResult = baseResult.filter(row => intersectingAppIds.includes(row['Games.appId']))

  console.log('Final result (before any limit):', finalResult.length, 'games')
  console.log('------------------------')

  return finalResult
}

// Helper function to run findGames for a single tag
async function findGamesSingleTag({
  tag,
  reviewScore,
  minReviews,
  maxReviews,
  minDate,
  maxDate,
  limit,
  reviewScoreOrBetter,
  hours
}) {
  // Build the same query structure as findGames but for a single tag
  const filters = [
    { member: 'Games.type', operator: 'equals', values: ['game'] },
    { member: 'GameTags.tag', operator: 'equals', values: [tag] }
  ]

  // Add review score filter
  if (reviewScore !== 'Any') {
    if (reviewScoreOrBetter) {
      const idx = reviewDescOrder.indexOf(reviewScore)
      if (idx !== -1) {
        const betterScores = reviewDescOrder.slice(0, idx + 1)
        filters.push({ member: 'Games.reviewScoreDesc', operator: 'in', values: betterScores })
      } else {
        filters.push({ member: 'Games.reviewScoreDesc', operator: 'equals', values: [reviewScore] })
      }
    } else {
      filters.push({ member: 'Games.reviewScoreDesc', operator: 'equals', values: [reviewScore] })
    }
  }

  // Add review count filters
  if (minReviews > 0) {
    filters.push({ member: 'Games.totalReviewsValue', operator: 'gte', values: [Number(minReviews)] })
  }
  if (maxReviews < 1000000) {
    filters.push({ member: 'Games.totalReviewsValue', operator: 'lte', values: [Number(maxReviews)] })
  }

  // Hours filter
  if (hours && typeof hours.value === 'number' && !Number.isNaN(hours.value)) {
    const op = hours.comparator === 'at_most' ? 'lte' : 'gte'
    filters.push({ member: 'Games.hours', operator: op, values: [hours.value] })
  }

  // Handle date range
  const timeDimensions = []
  if (minDate && maxDate) {
    timeDimensions.push({
      dimension: 'Games.releaseDate',
      dateRange: [minDate, maxDate]
    })
  }

  // Build query
  const query = {
    measures: ['Games.totalPositiveReviews', 'Games.totalNegativeReviews', 'Games.hours'],
    dimensions: [
      'Games.name',
      'Games.reviewScoreDesc',
      'Games.releaseDate',
      'Games.appId',
      'Games.totalReviewsValue'
    ],
    filters,
    order: [['Games.releaseDate', 'desc']]
  }

  if (timeDimensions.length > 0) {
    query.timeDimensions = timeDimensions
  }

  if (limit !== null) {
    query.limit = limit
  }

  // Execute query
  console.log('Single tag query for:', tag)
  const result = await queryCube(query)

  if (Array.isArray(result) && result.length > 0) {
    const standardized = result.map(row => 
      standardizeColumnNames(row, [
        'Games.totalReviewsValue',
        'Games.name',
        'Games.reviewScoreDesc',
        'Games.releaseDate',
        'Games.appId',
        'Games.totalPositiveReviews',
        'Games.totalNegativeReviews',
        'Games.hours'
      ])
    )
    
    const numeric = ensureNumeric(standardized, [
      'Games.totalReviewsValue',
      'Games.totalPositiveReviews',
      'Games.totalNegativeReviews',
      'Games.hours'
    ])
    
    // Convert date column
    const processed = numeric.map(row => ({
      ...row,
      'Games.releaseDate': row['Games.releaseDate'] ? new Date(row['Games.releaseDate']) : null
    }))
    
    console.log('Single tag query returned', processed.length, 'games')
    return processed
  } else {
    console.log('Single tag query returned no results')
    return []
  }
}

// Get app IDs for a given tag (for exclude functionality)
export async function getAppIdsForTag(tag) {
  try {
    const query = {
      dimensions: ['GameTags.appId'],
      filters: [
        { member: 'GameTags.tag', operator: 'equals', values: [tag] }
      ]
    }
    
    const result = await queryCube(query)
    
    if (Array.isArray(result) && result.length > 0) {
      const appIds = [...new Set(result.map(row => row['GameTags.appId']))]
      return appIds
    }
    
    return []
  } catch (error) {
    console.error('Error fetching app IDs for tag:', error)
    throw error
  }
}

// Get tags for a given app ID
export async function getTagsForAppId(appId, limit = 5) {
  try {
    const query = {
      dimensions: ['GameTags.tag'],
      filters: [
        { member: 'GameTags.appId', operator: 'equals', values: [appId] }
      ],
      order: [['GameTags.tag', 'asc']],
      limit
    }
    
    const result = await queryCube(query)
    
    if (Array.isArray(result) && result.length > 0) {
      const tags = [...new Set(result.map(row => row['GameTags.tag']))]
      return tags.filter(tag => tag && tag !== '')
    }
    
    return []
  } catch (error) {
    console.error('Error fetching tags for app ID:', error)
    throw error
  }
}

// Get all games for search (simplified query)
export async function getAllGames(limit = 5000) {
  try {
    const query = {
      dimensions: [
        'Games.name',
        'Games.appId'
      ],
      filters: [
        { member: 'Games.type', operator: 'equals', values: ['game'] }
      ],
      order: [['Games.name', 'asc']],
      limit
    }
    
    const result = await queryCube(query)
    
    if (Array.isArray(result) && result.length > 0) {
      return result.map(row => ({
        name: row['Games.name'],
        appId: row['Games.appId']
      }))
    }
    
    return []
  } catch (error) {
    console.error('Error fetching all games:', error)
    throw error
  }
}

// Daily cache management for popular games
function getDailyCache() {
  try {
    const cached = localStorage.getItem(LS_DAILY_CACHE_KEY)
    if (!cached) return null
    
    const data = JSON.parse(cached)
    const isFresh = Date.now() - data.timestamp < DAILY_CACHE_TTL_MS
    return isFresh ? data.games : null
  } catch (error) {
    console.log('Failed to read daily cache:', error)
    return null
  }
}

function setDailyCache(games) {
  try {
    const data = {
      timestamp: Date.now(),
      games: games
    }
    localStorage.setItem(LS_DAILY_CACHE_KEY, JSON.stringify(data))
  } catch (error) {
    console.log('Failed to save daily cache:', error)
  }
}

// Populate daily cache with popular games (run once per day)
export async function populateDailyCache() {
  try {
    console.log('Populating daily cache...')
    
    // Get top 10,000 games for comprehensive coverage
    const query = {
      dimensions: [
        'Games.name',
        'Games.appId'
      ],
      filters: [
        { member: 'Games.type', operator: 'equals', values: ['game'] }
      ],
      order: [['Games.totalReviews', 'desc']],
      limit: 10000
    }
    
    const result = await queryCube(query)
    
    if (Array.isArray(result) && result.length > 0) {
      const games = result.map(row => ({
        name: row['Games.name'],
        appId: row['Games.appId']
      }))
      
      setDailyCache(games)
      console.log('Daily cache populated with', games.length, 'games')
      return games
    }
    
    return []
  } catch (error) {
    console.error('Failed to populate daily cache:', error)
    return []
  }
}

// Check and ensure search index is available
export async function ensureDailyCache() {
  try {
    // Preload the search index instead of daily cache
    await preloadIndex()
    console.log('Search index ensured and ready')
    return []
  } catch (error) {
    console.warn('Failed to ensure search index:', error)
    return []
  }
}

// Algolia-style client-side search (no database queries)
export async function searchGamesByName(searchTerm, limit = 100) {
  try {
    // Use the new client-side search engine
    const results = await searchGames(searchTerm, { limit })
    
    // Map to expected format for compatibility
    return results.map(game => ({
      name: game.name,
      appId: game.appId
    }))
  } catch (error) {
    console.error('Error searching games:', error)
    // Return empty array as fallback
    return []
  }
}

// Find similar games using custom SimilarGames cube (single optimized query)
export async function findSimilarGames(appId, minCommonTags = 15) {
  try {
    console.log('Starting similarity search for appId:', appId)
    
    // Use the custom SimilarGames cube that implements the SQL JOIN logic
    const query = {
      dimensions: [
        'SimilarGames.name',
        'SimilarGames.appId',
        'SimilarGames.reviewScoreDesc',
        'SimilarGames.totalPositive',
        'SimilarGames.totalNegative',
        'SimilarGames.releaseDate',
        'SimilarGames.isFree'
      ],
      measures: [
        'SimilarGames.commonTags',
        'SimilarGames.similarityScore'
      ],
      filters: [
        { member: 'SimilarGames.inputAppId', operator: 'equals', values: [parseInt(appId)] }
      ],
      order: [
        ['SimilarGames.similarityScore', 'desc'],
        ['SimilarGames.commonTags', 'desc']
      ],
      limit: 100 // Get more results to filter client-side
    }
    
    const result = await queryCube(query)
    console.log('SimilarGames cube result:', result.length, 'rows')
    
    if (!Array.isArray(result) || result.length === 0) {
      return []
    }
    
    // Filter results to only include games with minimum common tags
    const filteredResults = result.filter(row => row['SimilarGames.commonTags'] >= minCommonTags)
    
    // Get the common tags for each game
    const results = []
    for (const row of filteredResults.slice(0, 20)) { // Limit to 20 results
      try {
        // Get the common tags for this specific game
        const tagsQuery = {
          dimensions: ['SimilarGames.commonTag'],
          filters: [
            { member: 'SimilarGames.inputAppId', operator: 'equals', values: [parseInt(appId)] },
            { member: 'SimilarGames.appId', operator: 'equals', values: [row['SimilarGames.appId']] }
          ]
        }
        
        const tagsResult = await queryCube(tagsQuery)
        const commonTagList = tagsResult.map(tagRow => tagRow['SimilarGames.commonTag']).sort()
        
        results.push({
          name: row['SimilarGames.name'],
          appId: row['SimilarGames.appId'],
          reviewScoreDesc: row['SimilarGames.reviewScoreDesc'],
          totalPositive: row['SimilarGames.totalPositive'],
          totalNegative: row['SimilarGames.totalNegative'],
          releaseDate: row['SimilarGames.releaseDate'],
          isFree: row['SimilarGames.isFree'],
          commonTags: row['SimilarGames.commonTags'],
          similarityScore: row['SimilarGames.similarityScore'],
          commonTagList: commonTagList
        })
      } catch (tagError) {
        console.warn(`Error getting tags for game ${row['SimilarGames.appId']}:`, tagError)
        // Add the game without tags
        results.push({
          name: row['SimilarGames.name'],
          appId: row['SimilarGames.appId'],
          reviewScoreDesc: row['SimilarGames.reviewScoreDesc'],
          totalPositive: row['SimilarGames.totalPositive'],
          totalNegative: row['SimilarGames.totalNegative'],
          releaseDate: row['SimilarGames.releaseDate'],
          isFree: row['SimilarGames.isFree'],
          commonTags: row['SimilarGames.commonTags'],
          similarityScore: row['SimilarGames.similarityScore'],
          commonTagList: []
        })
      }
    }
    
    console.log('Found', results.length, 'similar games')
    return results
    
  } catch (error) {
    console.error('Error finding similar games:', error)
    throw error
  }
}

export default {
  getAllTags,
  searchTagsByName,
  getRecentTopGames,
  findGames,
  getAppIdsForTag,
  getTagsForAppId,
  getAllGames,
  searchGamesByName,
  findSimilarGames,
  prefetchWarmNames,
  filterWarmNames,
  populateDailyCache,
  ensureDailyCache
}
