import axios from 'axios'
import { searchGames, getSearchSuggestions, preloadIndex } from './searchEngine.js'
import { searchTags, getTagSuggestions, getTopTagsByCount, preloadIndex as preloadTagsIndex } from './tagsSearchEngine.js'
import {
  resolveTimeMachinePeriod,
  toYmd as formatYmd,
  previousPeriodRange,
  samePeriodLastYear,
  rangeWithinOneYear
} from '../utils/timeMachine.js'

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

// Longer timeout for analytics fan-out queries
const cubeAnalyticsApi = axios.create({
  baseURL: CUBEJS_API_URL,
  timeout: 90000,
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

// ------------------------------------------------------------
// Cached exclusion sets (adult tags, user exclude tags, content descriptors)
// Avoids re-querying Cube for the same large appId lists on every search.
// ------------------------------------------------------------
const EXCLUDE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const LS_EXCLUDE_TAG_PREFIX = 'gd_exclude_tag_v1:'
const LS_CONTENT_DESC_KEY = 'gd_exclude_content_desc_v1'
export const ADULT_CONTENT_TAGS = ['Sexual Content', 'Hentai']
const tagAppIdCache = new Map() // tag -> { ts, appIds }
let contentDescriptorMemoryCache = null // { ts, appIds }

function readJsonCache(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.appIds)) return null
    if (Date.now() - (parsed.ts || 0) >= ttlMs) return null
    return parsed.appIds
  } catch (_) {
    return null
  }
}

function writeJsonCache(key, appIds) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), appIds }))
  } catch (_) {
    // ignore quota errors
  }
}

async function getCachedAppIdsForTag(tag) {
  const mem = tagAppIdCache.get(tag)
  if (mem && Date.now() - mem.ts < EXCLUDE_CACHE_TTL_MS) {
    return mem.appIds
  }

  const fromLs = readJsonCache(`${LS_EXCLUDE_TAG_PREFIX}${tag}`, EXCLUDE_CACHE_TTL_MS)
  if (fromLs) {
    tagAppIdCache.set(tag, { ts: Date.now(), appIds: fromLs })
    return fromLs
  }

  const appIds = await getAppIdsForTag(tag)
  tagAppIdCache.set(tag, { ts: Date.now(), appIds })
  writeJsonCache(`${LS_EXCLUDE_TAG_PREFIX}${tag}`, appIds)
  return appIds
}

async function getCachedContentDescriptorAppIds() {
  if (
    contentDescriptorMemoryCache &&
    Date.now() - contentDescriptorMemoryCache.ts < EXCLUDE_CACHE_TTL_MS
  ) {
    return contentDescriptorMemoryCache.appIds
  }

  const fromLs = readJsonCache(LS_CONTENT_DESC_KEY, EXCLUDE_CACHE_TTL_MS)
  if (fromLs) {
    contentDescriptorMemoryCache = { ts: Date.now(), appIds: fromLs }
    return fromLs
  }

  const appIds = await getAppIdsForContentDescriptors()
  contentDescriptorMemoryCache = { ts: Date.now(), appIds }
  writeJsonCache(LS_CONTENT_DESC_KEY, appIds)
  return appIds
}

/**
 * Resolve app IDs that should be excluded from results.
 * Fetches tag/content-descriptor sets in parallel and caches them for 24h.
 */
export async function resolveExcludedAppIds({
  excludeTags = [],
  includeAdultGames = true
} = {}) {
  const tagsToExclude = [
    ...(Array.isArray(excludeTags) ? excludeTags : []),
    ...(!includeAdultGames ? ADULT_CONTENT_TAGS : [])
  ]

  const uniqueTags = [...new Set(tagsToExclude.filter(Boolean))]
  const tagIdLists = await Promise.all(
    uniqueTags.map(async (tag) => {
      try {
        return await getCachedAppIdsForTag(tag)
      } catch (err) {
        console.error(`Error getting app IDs for exclude tag ${tag}:`, err)
        return []
      }
    })
  )

  const allIds = tagIdLists.flat()

  if (!includeAdultGames) {
    try {
      allIds.push(...(await getCachedContentDescriptorAppIds()))
    } catch (err) {
      console.error('Error getting content descriptor exclusions:', err)
    }
  }

  return [...new Set(allIds)]
}

function buildAppIdExcludeFilter(member, excludedAppIds) {
  if (!excludedAppIds || excludedAppIds.length === 0) return null
  // Keep original types from Cube so notEquals matches the dimension type
  return {
    member,
    operator: 'notEquals',
    values: excludedAppIds
  }
}

/** Map UI orderBy keys to Cube order so server-side limit keeps the right top-N. */
function mapOrderByToCube(orderBy) {
  switch (orderBy) {
    case 'release_date_asc':
      return [['Games.releaseDate', 'asc']]
    case 'release_date_desc':
      return [['Games.releaseDate', 'desc']]
    case 'total_reviews_asc':
      return [['Games.totalReviewsValue', 'asc']]
    case 'total_reviews_desc':
      return [['Games.totalReviewsValue', 'desc']]
    case 'game_name_asc':
      return [['Games.name', 'asc']]
    case 'game_name_desc':
      return [['Games.name', 'desc']]
    case 'review_score_asc':
    case 'steam_score_asc':
      // No percent measure in Cube; approximate with positive review count
      return [['Games.totalPositiveReviews', 'asc']]
    case 'review_score_desc':
    case 'steam_score_desc':
      return [['Games.totalPositiveReviews', 'desc']]
    default:
      return [['Games.totalReviewsValue', 'desc']]
  }
}

// Helper function to make Cube.js API calls with retry logic.
// Uses POST so large exclusion filters are not limited by GET URL length.
async function queryCube(query, maxRetries = 3, baseDelay = 1, { analytics = false, signal = null, continueWaitDelayMs = null } = {}) {
  console.log('Cube.js Query:', query)
  const client = analytics ? cubeAnalyticsApi : cubeApi

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
    try {
      const response = await client.post('/load', { query }, signal ? { signal } : undefined)

      if (response.data.error) {
        const errorMsg = response.data.error

        // Check if it's a timeout-related error
        if (errorMsg.toLowerCase().includes('timeout') ||
            errorMsg.toLowerCase().includes('continue wait')) {
          if (attempt <= maxRetries) {
            const delay = continueWaitDelayMs != null
              ? continueWaitDelayMs / 1000
              : baseDelay * Math.pow(2, attempt - 1) + Math.random()
            console.log(`Cube.js timeout error. Retrying in ${delay.toFixed(2)} seconds... (Attempt ${attempt} of ${maxRetries})`)
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, delay * 1000)
              if (signal) {
                signal.addEventListener('abort', () => {
                  clearTimeout(timer)
                  const err = new Error('Aborted')
                  err.name = 'AbortError'
                  reject(err)
                }, { once: true })
              }
            })
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
      if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED' || signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }
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

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ERR_CANCELED'
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
export async function getRecentTopGames(limit = 100, includeAdultGames = false) {
  try {
    const excludedAppIds = await resolveExcludedAppIds({ includeAdultGames })
    const excludeFilter = buildAppIdExcludeFilter('RecentTopGames.appId', excludedAppIds)

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
      limit,
      ...(excludeFilter ? { filters: [excludeFilter] } : {})
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
        reviewScoreOrBetter: true,
        includeAdultGames
      })
      
      console.log('Fallback search returned', fallbackResult.length, 'games')
      return fallbackResult
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError)
      throw fallbackError
    }
  }
}

/**
 * Review-label filter. `reviewScores` is an explicit IN list (dig game "at least").
 * Otherwise the finder "or better" prefix of reviewDescOrder is used.
 */
function appendReviewScoreFilter(filters, { reviewScore, reviewScoreOrBetter, reviewScores }) {
  if (Array.isArray(reviewScores) && reviewScores.length > 0) {
    filters.push({
      member: 'Games.reviewScoreDesc',
      operator: 'in',
      values: reviewScores
    })
    return
  }

  if (reviewScore && reviewScore !== 'Any') {
    if (reviewScoreOrBetter) {
      const idx = reviewDescOrder.indexOf(reviewScore)
      if (idx !== -1) {
        filters.push({
          member: 'Games.reviewScoreDesc',
          operator: 'in',
          values: reviewDescOrder.slice(0, idx + 1)
        })
      } else {
        filters.push({ member: 'Games.reviewScoreDesc', operator: 'equals', values: [reviewScore] })
      }
    } else {
      filters.push({ member: 'Games.reviewScoreDesc', operator: 'equals', values: [reviewScore] })
    }
  }
}

// Find games with filters
export async function findGames({
  tags = null,
  reviewScore = 'Any',
  reviewScores = null,
  minReviews = 0,
  maxReviews = 1000000,
  minDate = null,
  maxDate = null,
  limit = 100,
  reviewScoreOrBetter = true,
  hours = null, // { comparator: 'at_least' | 'at_most', value: number } | null
  aiDeclaration = 'any', // 'any' | 'declared' | 'not_declared'
  excludeTags = null,
  includeAdultGames = true,
  orderBy = 'total_reviews_desc',
  strict = false
}) {
  try {
    const excludedAppIds = await resolveExcludedAppIds({
      excludeTags: excludeTags || [],
      includeAdultGames
    })
    const excludeFilter = buildAppIdExcludeFilter('Games.appId', excludedAppIds)
    const cubeOrder = mapOrderByToCube(orderBy)

    const filters = [
      { member: 'Games.type', operator: 'equals', values: ['game'] }
    ]
    if (excludeFilter) {
      filters.push(excludeFilter)
    }

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
          reviewScores,
          minReviews,
          maxReviews,
          minDate,
          maxDate,
          limit: null, // Don't limit individual tag queries
          reviewScoreOrBetter,
          hours,
          aiDeclaration,
          excludedAppIds,
          orderBy
        })
        
        // Apply limit AFTER finding the intersection
        if (limit !== null && intersectionResult.length > limit) {
          return intersectionResult.slice(0, limit)
        }
        
        return intersectionResult
      }
    }

    appendReviewScoreFilter(filters, { reviewScore, reviewScoreOrBetter, reviewScores })

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

    appendAiDeclarationFilter(filters, aiDeclaration)

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
      order: cubeOrder
    }

    // Add timeDimensions only if not empty
    if (timeDimensions.length > 0) {
      query.timeDimensions = timeDimensions
    }

    // Add limit only if specified (null = unbounded, e.g. remove-limit checkbox)
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
      if (strict) throw error
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
      
      // Convert releaseDate to Date; Cube already applied the requested order + limit
      return numeric.map(row => ({
        ...row,
        'Games.releaseDate': row['Games.releaseDate'] ? new Date(row['Games.releaseDate']) : null
      }))
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
  reviewScores = null,
  minReviews,
  maxReviews,
  minDate,
  maxDate,
  limit, // This parameter is ignored - limit should be applied after intersection
  reviewScoreOrBetter,
  hours,
  aiDeclaration = 'any',
  excludedAppIds = [],
  orderBy = 'total_reviews_desc'
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
      reviewScores,
      minReviews,
      maxReviews,
      minDate,
      maxDate,
      limit: null, // Explicitly set to null to get all matching games
      reviewScoreOrBetter,
      hours,
      aiDeclaration,
      excludedAppIds,
      orderBy
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
  reviewScores = null,
  minReviews,
  maxReviews,
  minDate,
  maxDate,
  limit,
  reviewScoreOrBetter,
  hours,
  aiDeclaration = 'any',
  excludedAppIds = [],
  orderBy = 'total_reviews_desc'
}) {
  // Build the same query structure as findGames but for a single tag
  const filters = [
    { member: 'Games.type', operator: 'equals', values: ['game'] },
    { member: 'GameTags.tag', operator: 'equals', values: [tag] }
  ]
  const excludeFilter = buildAppIdExcludeFilter('Games.appId', excludedAppIds)
  if (excludeFilter) {
    filters.push(excludeFilter)
  }

  appendReviewScoreFilter(filters, { reviewScore, reviewScoreOrBetter, reviewScores })

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

  appendAiDeclarationFilter(filters, aiDeclaration)

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
    order: mapOrderByToCube(orderBy)
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

const DIG_WINDOWS = [80, 400, 1600, 6400, null]
const DIG_ROW_FIELDS = [
  'Games.totalReviewsValue',
  'Games.name',
  'Games.reviewScoreDesc',
  'Games.releaseDate',
  'Games.appId'
]

function digAppKey(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(Math.round(numeric)) : String(value ?? '')
}

function shapeDigRows(result) {
  if (!Array.isArray(result) || result.length === 0) return []
  const standardized = result.map((row) => standardizeColumnNames(row, DIG_ROW_FIELDS))
  const numeric = ensureNumeric(standardized, [
    'Games.totalReviewsValue'
  ])
  return numeric.map((row) => ({
    ...row,
    'Games.releaseDate': row['Games.releaseDate'] ? new Date(row['Games.releaseDate']) : null
  }))
}

async function queryDigWindow({
  tag = null,
  appIds = null,
  limit = null,
  reviewScores = null,
  minReviews = 0,
  maxReviews = 10000000,
  minDate = null,
  maxDate = null
}) {
  const filters = [
    { member: 'Games.type', operator: 'equals', values: ['game'] }
  ]
  if (tag) filters.push({ member: 'GameTags.tag', operator: 'equals', values: [tag] })
  if (appIds?.length) filters.push({ member: 'Games.appId', operator: 'equals', values: appIds })
  appendReviewScoreFilter(filters, { reviewScore: 'Any', reviewScoreOrBetter: false, reviewScores })
  if (minReviews > 0) {
    filters.push({ member: 'Games.totalReviewsValue', operator: 'gte', values: [Number(minReviews)] })
  }
  if (maxReviews < 1000000) {
    filters.push({ member: 'Games.totalReviewsValue', operator: 'lte', values: [Number(maxReviews)] })
  }
  const query = {
    dimensions: [
      'Games.name',
      'Games.reviewScoreDesc',
      'Games.releaseDate',
      'Games.appId',
      'Games.totalReviewsValue'
    ],
    filters,
    order: [['Games.totalReviewsValue', 'desc']]
  }
  if (minDate && maxDate) {
    query.timeDimensions = [{ dimension: 'Games.releaseDate', dateRange: [minDate, maxDate] }]
  }
  if (limit != null) query.limit = limit
  return shapeDigRows(await queryCube(query))
}

/**
 * Top matches for DIIIG. One bounded query on the rarest tag, then the other
 * tags are checked only against those games. Adult games are dropped locally
 * so the request does not carry the full exclusion list.
 */
export async function findDigMatches({
  tags = null,
  reviewScores = null,
  minReviews = 0,
  maxReviews = 10000000,
  minDate = null,
  maxDate = null,
  limit = 3
}) {
  const wanted = (Array.isArray(tags) ? tags : []).filter(Boolean)
  const excluded = new Set(
    (await resolveExcludedAppIds({ includeAdultGames: false })).map(digAppKey)
  )
  let anchor = wanted[0] || null
  let rest = wanted.slice(1)
  if (wanted.length > 1) {
    const pool = await getTopTagsByCount(24, ADULT_CONTENT_TAGS)
    const counts = new Map(pool.map((tag) => [tag.name, tag.count]))
    const ranked = [...wanted].sort((a, b) => (
      (counts.get(a) ?? Number.MAX_SAFE_INTEGER) - (counts.get(b) ?? Number.MAX_SAFE_INTEGER)
    ))
    anchor = ranked[0]
    rest = ranked.slice(1)
  }

  const shared = { reviewScores, minReviews, maxReviews, minDate, maxDate }
  for (const windowSize of DIG_WINDOWS) {
    const anchorRows = await queryDigWindow({ tag: anchor, limit: windowSize, ...shared })
    const eligible = anchorRows.filter((row) => !excluded.has(digAppKey(row['Games.appId'])))
    let matched = eligible
    if (rest.length && eligible.length) {
      const ids = eligible.map((row) => row['Games.appId'])
      const others = await Promise.all(rest.map((tag) => (
        queryDigWindow({ tag, appIds: ids, limit: ids.length, ...shared })
      )))
      let keep = new Set(eligible.map((row) => digAppKey(row['Games.appId'])))
      for (const rows of others) {
        const have = new Set(rows.map((row) => digAppKey(row['Games.appId'])))
        keep = new Set([...keep].filter((id) => have.has(id)))
      }
      matched = eligible.filter((row) => keep.has(digAppKey(row['Games.appId'])))
    }
    matched.sort((a, b) => (
      (Number(b['Games.totalReviewsValue']) || 0) - (Number(a['Games.totalReviewsValue']) || 0)
    ))
    const exhausted = windowSize == null || anchorRows.length < windowSize
    if (matched.length >= limit || exhausted) return matched.slice(0, limit)
  }
  return []
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

// Get app IDs for games with problematic content descriptors
// Filters games that contain: sexual assault, non-consensual, BDSM, extreme violence, or rape
export async function getAppIdsForContentDescriptors() {
  try {
    // Define the problematic content descriptor patterns
    const problematicPatterns = [
      'sexual assault',
      'non-consensual',
      'BDSM',
      'extreme violence',
      'rape'
    ]
    
    // Try different possible dimension names for content_descriptors
    const possibleDimensionNames = [
      'Games.contentDescriptors',
      'Games.content_descriptors',
      'Games.contentDescriptor'
    ]
    
    for (const dimensionName of possibleDimensionNames) {
      try {
        const query = {
          dimensions: [
            'Games.appId',
            dimensionName
          ],
          filters: [
            { member: 'Games.type', operator: 'equals', values: ['game'] }
          ]
        }
        
        const result = await queryCube(query)
        
        if (Array.isArray(result) && result.length > 0) {
          // Filter results client-side based on content descriptor patterns
          const excludedAppIds = []
          
          for (const row of result) {
            const contentDescriptors = row[dimensionName]
            if (!contentDescriptors) continue
            
            // Convert to lowercase string for case-insensitive matching
            const descriptorsStr = String(contentDescriptors).toLowerCase()
            
            // Check if any problematic pattern matches
            for (const pattern of problematicPatterns) {
              if (descriptorsStr.includes(pattern.toLowerCase())) {
                excludedAppIds.push(row['Games.appId'])
                break // Only add once per game
              }
            }
          }
          
          console.log(`Found ${excludedAppIds.length} games with problematic content descriptors using dimension: ${dimensionName}`)
          return [...new Set(excludedAppIds)]
        }
      } catch (dimensionError) {
        // Try next dimension name
        continue
      }
    }
    
    // If none of the dimension names worked, log a warning
    console.warn('content_descriptors dimension not found. Content descriptor filtering may not work. Make sure content_descriptors is exposed as a Cube.js dimension.')
    return []
  } catch (error) {
    console.error('Error fetching app IDs for content descriptors:', error)
    // Return empty array on error to avoid breaking the filtering flow
    return []
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
export async function findSimilarGames(appId, minCommonTags = 11) {
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

    // Cold SimilarGames queries often answer "Continue wait" for a while.
    // Keep polling on the longer client so the page can stay on "still searching"
    // instead of treating a timeout as an empty result set.
    const result = await queryCube(query, 12, 1, { analytics: true, continueWaitDelayMs: 1000 })
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

function toYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

function eachDayInclusive(start, end) {
  const days = []
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= last) {
    days.push(toYmd(cursor))
    cursor = addDays(cursor, 1)
  }
  return days
}

function extractCount(rows, measureKey) {
  if (!Array.isArray(rows) || rows.length === 0) return 0
  const value = rows[0]?.[measureKey]
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pickRowKey(row, prefixes) {
  if (!row) return null
  const keys = Object.keys(row)
  for (const prefix of prefixes) {
    const match = keys.find((key) => key === prefix || key.startsWith(`${prefix}.`))
    if (match) return match
  }
  return null
}

function fillDailySeries(rows, datePrefixes, countPrefixes, dayList) {
  const byDay = new Map()
  for (const row of rows || []) {
    const dateKey = pickRowKey(row, datePrefixes)
    const countKey = pickRowKey(row, countPrefixes)
    if (!dateKey || !countKey) continue
    const key = String(row[dateKey]).slice(0, 10)
    byDay.set(key, Number(row[countKey]) || 0)
  }
  return dayList.map((day) => ({
    date: day,
    count: byDay.get(day) || 0
  }))
}

async function queryCount(cube, measure, dateRange = null, signal = null, maxRetries = 2) {
  const query = {
    measures: [`${cube}.${measure}`]
  }
  if (dateRange) {
    query.timeDimensions = [{
      dimension: `${cube}.releaseDate`,
      dateRange
    }]
  }
  const rows = await queryCube(query, maxRetries, 1, {
    analytics: true,
    signal,
    continueWaitDelayMs: maxRetries > 2 ? 1000 : null
  })
  return extractCount(rows, `${cube}.${measure}`)
}

async function queryDailyCounts(cube, measure, dateRange, signal = null) {
  const query = {
    measures: [`${cube}.${measure}`],
    timeDimensions: [{
      dimension: `${cube}.releaseDate`,
      granularity: 'day',
      dateRange
    }],
    order: [[`${cube}.releaseDate`, 'asc']]
  }
  return queryCube(query, 2, 1, { analytics: true, signal })
}

function appendAiDeclarationFilter(filters, aiDeclaration) {
  if (aiDeclaration === 'declared') {
    filters.push({ member: 'Games.madeWithAi', operator: 'equals', values: [true] })
  } else if (aiDeclaration === 'not_declared') {
    filters.push({ member: 'Games.madeWithAi', operator: 'equals', values: [false] })
  }
}

function isMadeWithAi(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function fillAiDailySeries(rows, dayList) {
  const byDay = new Map()
  for (const row of rows || []) {
    const dateKey = pickRowKey(row, ['Games.releaseDate'])
    const countKey = pickRowKey(row, ['Games.count'])
    const aiKey = pickRowKey(row, ['Games.madeWithAi'])
    if (!dateKey || !countKey) continue
    const day = String(row[dateKey]).slice(0, 10)
    const entry = byDay.get(day) || { withAi: 0, withoutAi: 0 }
    const count = Number(row[countKey]) || 0
    if (isMadeWithAi(aiKey ? row[aiKey] : false)) entry.withAi += count
    else entry.withoutAi += count
    byDay.set(day, entry)
  }
  return dayList.map((date) => ({
    date,
    withAi: byDay.get(date)?.withAi || 0,
    withoutAi: byDay.get(date)?.withoutAi || 0
  }))
}

const AI_COUNT_RETRIES = 12

async function queryAiDailyCounts(dateRange, signal = null) {
  return queryCube({
    measures: ['Games.count'],
    dimensions: ['Games.madeWithAi'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      granularity: 'day',
      dateRange
    }],
    order: [['Games.releaseDate', 'asc']]
  }, AI_COUNT_RETRIES, 1, { analytics: true, signal, continueWaitDelayMs: 1000 })
}

async function loadAiReleaseMetrics(period, signal = null) {
  const monthDays = eachDayInclusive(period.monthStart, period.monthEnd)
  const compareRange = period.prevMonthToDateRange || period.prevMonthRange
  const jobs = [
    queryCount('Games', 'madeWithAiCount', period.range, signal, AI_COUNT_RETRIES),
    queryCount('Games', 'madeWithAiCount', compareRange, signal, AI_COUNT_RETRIES),
    queryCount('Games', 'madeWithAiCount', period.toDateRange, signal, AI_COUNT_RETRIES),
    queryCount('Games', 'count', period.range, signal, AI_COUNT_RETRIES),
    queryCount('Games', 'count', compareRange, signal, AI_COUNT_RETRIES),
    queryAiDailyCounts(period.range, signal)
  ]
  const settled = await Promise.allSettled(jobs)
  const abort = settled.find((result) => result.status === 'rejected' && isAbortError(result.reason))
  if (abort) throw abort.reason
  const valueOf = (result) => (result.status === 'fulfilled' ? result.value : null)
  const [monthCount, previousMonthCount, allTimeCount, monthTotal, previousMonthTotal, dailyRows] = settled.map(valueOf)
  const monthReady = monthCount != null && previousMonthCount != null && monthTotal != null && previousMonthTotal != null
  if (!monthReady && allTimeCount == null && !dailyRows) {
    console.warn('AI release metrics failed:', settled.filter((result) => result.status === 'rejected').map((result) => result.reason))
    return {
      aiMonthCount: null,
      aiPreviousMonthCount: null,
      aiAllTimeCount: null,
      aiMonthTotal: null,
      aiPreviousMonthTotal: null,
      aiDaily: null,
      aiError: 'AI declaration figures are not available from the analytics API yet.'
    }
  }
  return {
    aiMonthCount: monthCount,
    aiPreviousMonthCount: previousMonthCount,
    aiAllTimeCount: allTimeCount,
    aiMonthTotal: monthTotal,
    aiPreviousMonthTotal: previousMonthTotal,
    aiDaily: dailyRows ? fillAiDailySeries(dailyRows, monthDays) : null,
    aiError: null
  }
}

function aiMetricsReady(payload) {
  if (payload?.aiError) return false
  return payload?.aiMonthCount != null
    && payload?.aiPreviousMonthCount != null
    && payload?.aiAllTimeCount != null
    && payload?.aiMonthTotal != null
    && payload?.aiPreviousMonthTotal != null
    && Array.isArray(payload?.aiDaily)
}

const COUNT_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const MONTH_PAYLOAD_TTL_MS = 60 * 60 * 1000
const MONTH_PAYLOAD_CURRENT_TTL_MS = 15 * 60 * 1000
const MONTH_PAYLOAD_STALE_MS = 24 * 60 * 60 * 1000
const SOS_CONCURRENCY = 6
const countQueryCache = new Map() // rangeKey -> { ts, value }
const monthPayloadCache = new Map() // monthKey -> { ts, value }
let monthlyReleaseSeriesCache = null // { ts, rows: [{ month: 'YYYY-MM', count }] }

function countCacheKey(dateRange) {
  return Array.isArray(dateRange) ? dateRange.join('_') : String(dateRange)
}

function readCountCache(dateRange) {
  const key = countCacheKey(dateRange)
  const mem = countQueryCache.get(key)
  if (mem && Date.now() - mem.ts < COUNT_CACHE_TTL_MS) return mem.value
  try {
    const raw = sessionStorage.getItem(`gd_sos_count_${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || Date.now() - (parsed.ts || 0) >= COUNT_CACHE_TTL_MS) return null
    countQueryCache.set(key, { ts: parsed.ts, value: parsed.value })
    return parsed.value
  } catch (_) {
    return null
  }
}

function writeCountCache(dateRange, value) {
  const key = countCacheKey(dateRange)
  const entry = { ts: Date.now(), value }
  countQueryCache.set(key, entry)
  try {
    sessionStorage.setItem(`gd_sos_count_${key}`, JSON.stringify(entry))
  } catch (_) {
    // ignore quota
  }
}

function monthPayloadCacheKey(monthKey) {
  return `gd_sos_month_v7_${monthKey}`
}

function readStoredMonthEntry(monthKey) {
  const mem = monthPayloadCache.get(monthKey)
  if (mem?.value) return mem
  const stores = [sessionStorage, localStorage]
  for (const store of stores) {
    try {
      const raw = store.getItem(monthPayloadCacheKey(monthKey))
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!parsed?.value || !parsed.ts) continue
      monthPayloadCache.set(monthKey, parsed)
      return parsed
    } catch (_) {
      // ignore quota / private mode
    }
  }
  return null
}

function readMonthPayloadCache(monthKey, isCurrent) {
  const ttl = isCurrent ? MONTH_PAYLOAD_CURRENT_TTL_MS : MONTH_PAYLOAD_TTL_MS
  const entry = readStoredMonthEntry(monthKey)
  if (!entry || Date.now() - entry.ts >= ttl) return null
  return entry.value
}

function readStaleMonthPayload(monthKey) {
  const entry = readStoredMonthEntry(monthKey)
  if (!entry) return null
  const age = Date.now() - entry.ts
  if (age >= MONTH_PAYLOAD_STALE_MS) return null
  return entry.value
}

function writeMonthPayloadCache(monthKey, value) {
  const entry = { ts: Date.now(), value }
  monthPayloadCache.set(monthKey, entry)
  const raw = JSON.stringify(entry)
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.setItem(monthPayloadCacheKey(monthKey), raw)
    } catch (_) {
      // ignore quota
    }
  }
}

async function queryCachedCount(dateRange, signal = null) {
  const cached = readCountCache(dateRange)
  if (cached != null) return cached
  const value = await queryCount('Games', 'count', dateRange, signal)
  writeCountCache(dateRange, value)
  return value
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next
      next += 1
      results[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
  return results
}

async function softQuery(label, fallback, fn) {
  try {
    return await fn()
  } catch (error) {
    if (isAbortError(error)) throw error
    console.warn(`State of Steam soft-fail (${label}):`, error)
    return fallback
  }
}

function ymFromCubeDate(value) {
  return String(value || '').slice(0, 7)
}

async function queryMonthlyReleaseSeries(signal = null) {
  if (
    monthlyReleaseSeriesCache &&
    Date.now() - monthlyReleaseSeriesCache.ts < COUNT_CACHE_TTL_MS
  ) {
    return monthlyReleaseSeriesCache.rows
  }
  try {
    const raw = sessionStorage.getItem('gd_sos_monthly_series_v1')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Date.now() - (parsed.ts || 0) < COUNT_CACHE_TTL_MS && Array.isArray(parsed.rows)) {
        monthlyReleaseSeriesCache = parsed
        return parsed.rows
      }
    }
  } catch (_) {
    // ignore
  }

  const today = formatYmd(new Date())
  const rows = await queryCube({
    measures: ['Games.count'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      granularity: 'month',
      dateRange: ['2003-09-01', today]
    }],
    order: [['Games.releaseDate', 'asc']]
  }, 2, 1, { analytics: true, signal })

  const series = (rows || []).map((row) => {
    const dateKey = pickRowKey(row, ['Games.releaseDate'])
    const countKey = pickRowKey(row, ['Games.count'])
    return {
      month: ymFromCubeDate(row[dateKey]),
      count: Number(row[countKey]) || 0
    }
  }).filter((row) => row.month)

  const entry = { ts: Date.now(), rows: series }
  monthlyReleaseSeriesCache = entry
  try {
    sessionStorage.setItem('gd_sos_monthly_series_v1', JSON.stringify(entry))
  } catch (_) {
    // ignore
  }
  return series
}

function deriveHistoricalFromSeries(series, period) {
  const byMonth = new Map(series.map((row) => [row.month, row.count]))
  const selectedYm = `${period.year}-${String(period.monthIndex + 1).padStart(2, '0')}`
  const prev = new Date(period.year, period.monthIndex, 0)
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

  let selectedYearReleases = 0
  let previousYearReleases = 0
  let releasedToDate = 0
  for (const row of series) {
    const [y] = row.month.split('-').map(Number)
    if (y === period.year && row.month <= selectedYm) selectedYearReleases += row.count
    if (y === period.year - 1) previousYearReleases += row.count
    if (row.month <= selectedYm) releasedToDate += row.count
  }

  // Current month series may be capped mid-month in live daily data; prefer selected month
  // total from the panel when available (caller can override).
  return {
    previousMonthReleases: byMonth.get(prevYm) || 0,
    selectedYearReleases,
    previousYearReleases,
    releasedToDate,
    selectedMonthReleasesFromSeries: byMonth.get(selectedYm) || 0
  }
}

async function queryGenreReleaseCounts(dateRange, signal = null) {
  const rows = await queryCube({
    measures: ['Games.count'],
    dimensions: ['Genres.name'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    order: [['Games.count', 'desc']],
    filters: [
      { member: 'Genres.name', operator: 'set' }
    ],
    limit: 30
  }, 2, 1, { analytics: true, signal })

  return (rows || [])
    .map((row) => ({
      genre: row['Genres.name'] || 'Unknown',
      count: Number(row['Games.count']) || 0
    }))
    .filter((row) => row.genre && row.count > 0)
}

async function queryTagReleaseCounts(dateRange, signal = null) {
  const rows = await queryCube({
    measures: ['Games.count'],
    dimensions: ['GameTags.tag'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    order: [['Games.count', 'desc']],
    filters: [
      { member: 'GameTags.tag', operator: 'set' }
    ],
    limit: 20
  }, 2, 1, { analytics: true, signal })

  return (rows || [])
    .map((row) => ({
      tag: row['GameTags.tag'] || 'Unknown',
      count: Number(row['Games.count']) || 0
    }))
    .filter((row) => row.tag && row.count > 0)
}

async function queryReviewTotals(dateRange, signal = null) {
  const rows = await queryCube({
    measures: [
      'Games.totalPositiveReviews',
      'Games.totalNegativeReviews'
    ],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }]
  }, 2, 1, { analytics: true, signal })
  const row = rows?.[0] || {}
  const positive = Number(row['Games.totalPositiveReviews']) || 0
  const negative = Number(row['Games.totalNegativeReviews']) || 0
  const total = positive + negative
  const positiveShare = total > 0 ? (positive / total) * 100 : 0
  return { positive, negative, total, positiveShare }
}

async function queryReviewScoreMix(dateRange, signal = null) {
  const rows = await queryCube({
    measures: ['Games.count'],
    dimensions: ['Games.reviewScoreDesc'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    order: [['Games.count', 'desc']],
    filters: [
      { member: 'Games.reviewScoreDesc', operator: 'set' }
    ]
  }, 2, 1, { analytics: true, signal })
  return (rows || [])
    .map((row) => ({
      score: row['Games.reviewScoreDesc'] || 'Unknown',
      count: Number(row['Games.count']) || 0
    }))
    .filter((row) => row.count > 0)
}

async function queryFreeVsPaid(dateRange, signal = null) {
  const rows = await queryCube({
    measures: ['Games.count'],
    dimensions: ['Games.isFree'],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }]
  }, 2, 1, { analytics: true, signal })
  let free = 0
  let paid = 0
  for (const row of rows || []) {
    const count = Number(row['Games.count']) || 0
    const flag = row['Games.isFree']
    if (flag === true || flag === 'true' || flag === 1 || flag === '1') free += count
    else paid += count
  }
  return { free, paid }
}

async function queryReleasedGamesForSentiment(dateRange, limit = 100, signal = null) {
  return queryCube({
    measures: [
      'Games.totalPositiveReviews',
      'Games.totalNegativeReviews'
    ],
    dimensions: [
      'Games.appId',
      'Games.name',
      'Games.totalReviewsValue'
    ],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    filters: [
      { member: 'Games.totalReviewsValue', operator: 'gte', values: [1000] }
    ],
    order: [['Games.totalReviewsValue', 'desc']],
    limit
  }, 2, 1, { analytics: true, signal })
}

function rankSentimentGames(rows) {
  const games = (rows || []).map((row) => {
    const positive = Number(row['Games.totalPositiveReviews']) || 0
    const negative = Number(row['Games.totalNegativeReviews']) || 0
    const total = positive + negative || Number(row['Games.totalReviewsValue']) || 0
    const loveRate = total > 0 ? (positive / total) * 100 : 0
    const hateRate = total > 0 ? (negative / total) * 100 : 0
    const mixDistance = Math.abs(loveRate - 50)
    return {
      appId: row['Games.appId'],
      name: row['Games.name'],
      positive,
      negative,
      totalReviews: total,
      loveRate,
      hateRate,
      mixDistance
    }
  }).filter((g) => g.totalReviews >= 1000)

  const mostLoved = [...games]
    .sort((a, b) => b.loveRate - a.loveRate || b.totalReviews - a.totalReviews)
    .slice(0, 10)
  const mostHated = [...games]
    .sort((a, b) => b.hateRate - a.hateRate || b.totalReviews - a.totalReviews)
    .slice(0, 10)
  const mostMixed = [...games]
    .sort((a, b) => a.mixDistance - b.mixDistance || b.totalReviews - a.totalReviews)
    .slice(0, 10)

  return { mostLoved, mostHated, mostMixed }
}

async function queryStudioLeaderboard(nameDimension, dateRange, limit = 40, signal = null) {
  const rows = await queryCube({
    measures: [
      'Games.count',
      'Games.totalPositiveReviews',
      'Games.totalNegativeReviews'
    ],
    dimensions: [nameDimension],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    filters: [
      { member: nameDimension, operator: 'set' }
    ],
    order: [['Games.count', 'desc']],
    limit
  }, 2, 1, { analytics: true, signal })

  return (rows || []).map((row) => {
    const games = Number(row['Games.count']) || 0
    const positive = Number(row['Games.totalPositiveReviews']) || 0
    const negative = Number(row['Games.totalNegativeReviews']) || 0
    const reviews = positive + negative
    const loveRate = reviews > 0 ? (positive / reviews) * 100 : 0
    const praisePerGame = games > 0 ? positive / games : 0
    return {
      name: row[nameDimension] || 'Unknown',
      games,
      positive,
      negative,
      reviews,
      loveRate,
      praisePerGame
    }
  }).filter((row) => row.name && row.games > 0)
}

function rankStudios(studios) {
  const prolific = [...studios]
    .sort((a, b) => b.games - a.games || b.reviews - a.reviews)
    .slice(0, 10)
  const revered = [...studios]
    .filter((s) => s.reviews >= 100)
    .sort((a, b) => b.loveRate - a.loveRate || b.praisePerGame - a.praisePerGame)
    .slice(0, 10)
  return { prolific, revered }
}

function emptyReviewTotals() {
  return { positive: 0, negative: 0, total: 0, positiveShare: 0 }
}

function emptyFreeVsPaid() {
  return { free: 0, paid: 0 }
}

async function fetchStateOfSteamSnapshot(monthKey, signal = null) {
  const key = monthKey === 'this-month'
    ? (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    : monthKey

  try {
    const rows = await queryCube({
      dimensions: [
        'StateOfSteamMonthly.monthKey',
        'StateOfSteamMonthly.payload',
        'StateOfSteamMonthly.builtAt'
      ],
      filters: [
        { member: 'StateOfSteamMonthly.monthKey', operator: 'equals', values: [key] }
      ],
      limit: 1
    }, 1, 1, { analytics: true, signal })

    const row = rows?.[0]
    if (!row) return null
    let payload = row['StateOfSteamMonthly.payload']
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch (_) {
        return null
      }
    }
    if (!payload || typeof payload !== 'object') return null
    return {
      ...payload,
      _snapshotMonthKey: key,
      _snapshotBuiltAt: row['StateOfSteamMonthly.builtAt'] || null,
      source: 'snapshot'
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    // Cube model may not be deployed yet
    console.warn('State of Steam snapshot unavailable:', error.message || error)
    return null
  }
}

function livePatchFromTask(key, value) {
  if (key === 'releasedDaily') {
    const rows = value || []
    return {
      releasedInMonthDaily: rows,
      selectedMonthReleases: rows.reduce((sum, row) => sum + (row.count || 0), 0)
    }
  }
  if (key === 'genresInMonth') return { genresInMonth: value || [] }
  if (key === 'tagsInMonth') return { tagsInMonth: value || [] }
  if (key === 'reviewTotals') return { reviewTotals: value || emptyReviewTotals() }
  if (key === 'reviewScoreMix') return { reviewScoreMix: value || [] }
  if (key === 'freeVsPaid') return { freeVsPaid: value || emptyFreeVsPaid() }
  if (key === 'sentimentRows') return rankSentimentGames(value)
  if (key === 'publisherStudios') {
    const publishers = rankStudios(value || [])
    return {
      prolificPublishers: publishers.prolific,
      reveredPublishers: publishers.revered
    }
  }
  if (key === 'developerStudios') {
    const developers = rankStudios(value || [])
    return {
      prolificDevelopers: developers.prolific,
      reveredDevelopers: developers.revered
    }
  }
  return null
}

async function loadStateOfSteamLivePanel(period, signal = null, onProgress = null) {
  const { range } = period
  const monthDays = eachDayInclusive(period.monthStart, period.monthEnd)

  const tasks = [
    {
      key: 'releasedDaily',
      run: () => queryDailyCounts('Games', 'count', range, signal).then((rows) =>
        fillDailySeries(rows, ['Games.releaseDate'], ['Games.count'], monthDays)
      ),
      fallback: monthDays.map((date) => ({ date, count: 0 }))
    },
    {
      key: 'genresInMonth',
      run: () => queryGenreReleaseCounts(range, signal),
      fallback: []
    },
    {
      key: 'tagsInMonth',
      run: () => queryTagReleaseCounts(range, signal),
      fallback: []
    },
    {
      key: 'reviewTotals',
      run: () => queryReviewTotals(range, signal),
      fallback: emptyReviewTotals()
    },
    {
      key: 'reviewScoreMix',
      run: () => queryReviewScoreMix(range, signal),
      fallback: []
    },
    {
      key: 'freeVsPaid',
      run: () => queryFreeVsPaid(range, signal),
      fallback: emptyFreeVsPaid()
    },
    {
      key: 'sentimentRows',
      run: () => queryReleasedGamesForSentiment(range, 100, signal),
      fallback: []
    },
    {
      key: 'publisherStudios',
      run: () => queryStudioLeaderboard('Publishers.name', range, 40, signal),
      fallback: []
    },
    {
      key: 'developerStudios',
      run: () => queryStudioLeaderboard('Developers.name', range, 40, signal),
      fallback: []
    }
  ]

  const settled = await mapPool(tasks, SOS_CONCURRENCY, async (task) => {
    let value = task.fallback
    let ok = false
    try {
      value = await task.run()
      ok = true
    } catch (error) {
      if (isAbortError(error)) throw error
      console.warn(`State of Steam soft-fail (${task.key}):`, error)
    }
    if (ok && onProgress) {
      const patch = livePatchFromTask(task.key, value)
      if (patch) onProgress(patch)
    }
    return { key: task.key, value }
  })

  const byKey = Object.fromEntries(settled.map((row) => [row.key, row.value]))
  const { mostLoved, mostHated, mostMixed } = rankSentimentGames(byKey.sentimentRows)
  const publishers = rankStudios(byKey.publisherStudios)
  const developers = rankStudios(byKey.developerStudios)
  const releasedDailyRows = byKey.releasedDaily || []
  const selectedMonthReleases = releasedDailyRows.reduce((sum, row) => sum + (row.count || 0), 0)

  return {
    releasedInMonthDaily: releasedDailyRows,
    genresInMonth: byKey.genresInMonth || [],
    tagsInMonth: byKey.tagsInMonth || [],
    reviewTotals: byKey.reviewTotals || emptyReviewTotals(),
    reviewScoreMix: byKey.reviewScoreMix || [],
    freeVsPaid: byKey.freeVsPaid || emptyFreeVsPaid(),
    mostLoved,
    mostHated,
    mostMixed,
    prolificPublishers: publishers.prolific,
    reveredPublishers: publishers.revered,
    prolificDevelopers: developers.prolific,
    reveredDevelopers: developers.revered,
    selectedMonthReleases,
    source: 'live'
  }
}

async function loadStateOfSteamHistorical(period, signal = null) {
  // Prefer one monthly series query (hits Cube month pre-agg) over four huge range scans
  try {
    const series = await queryMonthlyReleaseSeries(signal)
    const derived = deriveHistoricalFromSeries(series, period)
    return {
      previousMonthReleases: derived.previousMonthReleases,
      selectedYearReleases: derived.selectedYearReleases,
      previousYearReleases: derived.previousYearReleases,
      releasedToDate: derived.releasedToDate,
      historicalStatus: 'ready',
      historicalError: null
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    console.warn('Monthly series failed; falling back to range counts:', error)
  }

  const { prevMonthRange, yearRange, prevYearRange, toDateRange } = period
  const [previousMonthReleases, selectedYearReleases, previousYearReleases, releasedToDate] =
    await mapPool(
      [
        { label: 'prevMonth', range: prevMonthRange, fallback: 0 },
        { label: 'year', range: yearRange, fallback: 0 },
        { label: 'prevYear', range: prevYearRange, fallback: 0 },
        { label: 'toDate', range: toDateRange, fallback: 0 }
      ],
      2,
      async (task) => softQuery(
        task.label,
        task.fallback,
        () => queryCachedCount(task.range, signal)
      )
    )

  return {
    previousMonthReleases,
    selectedYearReleases,
    previousYearReleases,
    releasedToDate,
    historicalStatus: 'ready',
    historicalError: null
  }
}

function metricsFromSnapshot(period, snapshot) {
  return {
    period,
    ...snapshot,
    previousMonthReleases: snapshot.previousMonthReleases ?? null,
    selectedYearReleases: snapshot.selectedYearReleases ?? null,
    previousYearReleases: snapshot.previousYearReleases ?? null,
    releasedToDate: snapshot.releasedToDate ?? null,
    historicalStatus: snapshot.releasedToDate != null ? 'ready' : 'loading',
    historicalError: null,
    source: 'snapshot'
  }
}

/**
 * State of Steam dashboard metrics for a Time Machine month selection.
 *
 * Load strategy:
 *  1) Fresh session/local cache
 *  2) Stale cache painted immediately, then refreshed
 *  3) Precomputed monthly snapshot painted as soon as it arrives
 *  4) Live panel queries (higher concurrency), each section published as it finishes
 *  5) Historical rollups in parallel with the live panel
 *
 * @param {string} monthKey 'this-month' or 'YYYY-MM'
 * @param {{ signal?: AbortSignal, onUpdate?: (metrics: object) => void, onHistorical?: (hist: object) => void }} [opts]
 */
export async function getStateOfSteamMetrics(monthKey = 'this-month', opts = {}) {
  const { signal = null, onHistorical = null, onUpdate = null } = opts
  const period = resolveTimeMachinePeriod(monthKey)
  const cacheKey = period.key

  const cached = readMonthPayloadCache(cacheKey, period.isCurrent)
  if (cached?.period) {
    let current = { ...cached, period }
    onUpdate?.(current)
    if (current.historicalStatus !== 'ready' && onHistorical) {
      queueHistorical(period, current, signal, onHistorical)
    } else if (onHistorical && current.historicalStatus === 'ready') {
      onHistorical({
        previousMonthReleases: current.previousMonthReleases,
        selectedYearReleases: current.selectedYearReleases,
        previousYearReleases: current.previousYearReleases,
        releasedToDate: current.releasedToDate,
        historicalStatus: 'ready',
        historicalError: null
      })
    }
    if (!aiMetricsReady(current)) {
      loadAiReleaseMetrics(period, signal).then((patch) => {
        if (signal?.aborted) return
        current = { ...current, ...patch, period }
        onUpdate?.(current)
        writeMonthPayloadCache(cacheKey, current)
      }).catch((error) => {
        if (isAbortError(error) || signal?.aborted) return
        console.warn('AI release metrics failed:', error)
      })
    }
    return current
  }

  let latest = {
    period,
    previousMonthReleases: null,
    selectedYearReleases: null,
    previousYearReleases: null,
    releasedToDate: null,
    aiMonthCount: null,
    aiPreviousMonthCount: null,
    aiAllTimeCount: null,
    aiMonthTotal: null,
    aiPreviousMonthTotal: null,
    aiDaily: null,
    historicalStatus: 'loading',
    historicalError: null
  }
  let livePieces = 0
  let panelSettled = false

  const publish = (patch) => {
    if (signal?.aborted) return latest
    latest = { ...latest, ...patch, period }
    onUpdate?.(latest)
    return latest
  }

  loadAiReleaseMetrics(period, signal).then((patch) => {
    if (signal?.aborted) return
    const next = publish(patch)
    writeMonthPayloadCache(cacheKey, next)
  }).catch((error) => {
    if (isAbortError(error) || signal?.aborted) return
    console.warn('AI release metrics failed:', error)
  })

  const stale = readStaleMonthPayload(cacheKey)
  let blockSnapshot = Boolean(stale)
  if (stale && typeof stale === 'object') {
    publish({ ...stale, period })
  }

  let snapshotPromise = null
  const loadSnapshot = () => {
    if (!snapshotPromise) {
      snapshotPromise = softQuery('snapshot', null, () => fetchStateOfSteamSnapshot(cacheKey, signal))
    }
    return snapshotPromise
  }

  if (!period.isCurrent) {
    const snapshot = await loadSnapshot()
    if (snapshot) {
      const metrics = publish(metricsFromSnapshot(period, snapshot))
      writeMonthPayloadCache(cacheKey, metrics)
      if (metrics.historicalStatus !== 'ready' && onHistorical) {
        queueHistorical(period, metrics, signal, (hist) => {
          const merged = publish(hist)
          writeMonthPayloadCache(cacheKey, merged)
          onHistorical(hist)
        })
      } else if (onHistorical && metrics.historicalStatus === 'ready') {
        onHistorical({
          previousMonthReleases: metrics.previousMonthReleases,
          selectedYearReleases: metrics.selectedYearReleases,
          previousYearReleases: metrics.previousYearReleases,
          releasedToDate: metrics.releasedToDate,
          historicalStatus: 'ready',
          historicalError: null
        })
      }
      return metrics
    }
  } else if (!stale) {
    // One precomputed row paints the current month while the live fan-out is still running.
    loadSnapshot().then((snapshot) => {
      if (!snapshot || signal?.aborted || livePieces > 0 || blockSnapshot) return
      publish(metricsFromSnapshot(period, snapshot))
    }).catch(() => {})
  }

  loadStateOfSteamHistorical(period, signal)
    .then((hist) => {
      if (signal?.aborted) return
      blockSnapshot = true
      publish(hist)
      if (panelSettled) writeMonthPayloadCache(cacheKey, latest)
      if (onHistorical) onHistorical(hist)
    })
    .catch((error) => {
      if (isAbortError(error) || signal?.aborted) return
      console.warn('Historical State of Steam load failed:', error)
      const hist = {
        previousMonthReleases: latest.previousMonthReleases ?? 0,
        selectedYearReleases: latest.selectedYearReleases ?? 0,
        previousYearReleases: latest.previousYearReleases ?? 0,
        releasedToDate: latest.releasedToDate ?? 0,
        historicalStatus: 'error',
        historicalError: 'Could not load historical release totals.'
      }
      publish(hist)
      if (onHistorical) onHistorical(hist)
    })

  const panel = await loadStateOfSteamLivePanel(period, signal, (patch) => {
    livePieces += 1
    publish({ ...patch, source: 'live' })
  })

  if (livePieces > 0) {
    publish({ ...panel, source: 'live' })
  } else if ((latest.selectedMonthReleases || 0) === 0) {
    const snapshot = await loadSnapshot()
    if (snapshot && (snapshot.selectedMonthReleases || 0) > 0) {
      publish(metricsFromSnapshot(period, snapshot))
    } else {
      publish({ ...panel, source: 'live' })
    }
  }

  panelSettled = true
  writeMonthPayloadCache(cacheKey, latest)
  return latest
}

function queueHistorical(period, metrics, signal, onHistorical) {
  Promise.resolve()
    .then(() => loadStateOfSteamHistorical(period, signal))
    .then((hist) => {
      if (signal?.aborted) return
      onHistorical(hist)
    })
    .catch((error) => {
      if (isAbortError(error) || signal?.aborted) return
      console.warn('Historical State of Steam load failed:', error)
      onHistorical({
        previousMonthReleases: metrics.previousMonthReleases ?? 0,
        selectedYearReleases: metrics.selectedYearReleases ?? 0,
        previousYearReleases: metrics.previousYearReleases ?? 0,
        releasedToDate: metrics.releasedToDate ?? 0,
        historicalStatus: 'error',
        historicalError: 'Could not load historical release totals.'
      })
    })
}

const TREND_GENRE_LIMIT = 100
const TREND_TAG_LIMIT = 200

async function queryDimensionReleaseCounts(dimension, dateRange, limit, signal = null) {
  const rows = await queryCube({
    measures: ['Games.count'],
    dimensions: [dimension],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    order: [['Games.count', 'desc']],
    filters: [
      { member: dimension, operator: 'set' }
    ],
    limit
  }, 2, 1, { analytics: true, signal })

  return (rows || [])
    .map((row) => ({
      name: row[dimension] || '',
      count: Number(row['Games.count']) || 0
    }))
    .filter((row) => row.name && row.count > 0)
}

async function queryDimensionCountsForNames(dimension, dateRange, names, signal = null) {
  const counts = new Map()
  if (!names.length) return counts

  const chunkSize = 80
  const chunks = []
  for (let i = 0; i < names.length; i += chunkSize) {
    chunks.push(names.slice(i, i + chunkSize))
  }

  await mapPool(chunks, 3, async (chunk) => {
    const rows = await queryCube({
      measures: ['Games.count'],
      dimensions: [dimension],
      timeDimensions: [{
        dimension: 'Games.releaseDate',
        dateRange
      }],
      filters: [
        { member: dimension, operator: 'equals', values: chunk }
      ],
      limit: chunk.length
    }, 2, 1, { analytics: true, signal })

    for (const row of rows || []) {
      const name = row[dimension]
      if (name) counts.set(name, Number(row['Games.count']) || 0)
    }
  })

  return counts
}

async function buildTrendSeries(dimension, currentRange, previousRange, limit, signal = null) {
  const [currentRows, previousRows] = await Promise.all([
    queryDimensionReleaseCounts(dimension, currentRange, limit, signal),
    queryDimensionReleaseCounts(dimension, previousRange, limit, signal)
  ])

  const currentMap = new Map(currentRows.map((row) => [row.name, row.count]))
  const previousMap = new Map(previousRows.map((row) => [row.name, row.count]))
  const names = [...new Set([...currentMap.keys(), ...previousMap.keys()])]

  const [filledCurrent, filledPrevious] = await Promise.all([
    queryDimensionCountsForNames(
      dimension,
      currentRange,
      names.filter((name) => !currentMap.has(name)),
      signal
    ),
    queryDimensionCountsForNames(
      dimension,
      previousRange,
      names.filter((name) => !previousMap.has(name)),
      signal
    )
  ])

  for (const [name, count] of filledCurrent) currentMap.set(name, count)
  for (const [name, count] of filledPrevious) previousMap.set(name, count)

  return names
    .map((name) => ({
      name,
      current: currentMap.get(name) || 0,
      previous: previousMap.get(name) || 0
    }))
    .filter((row) => row.current > 0 || row.previous > 0)
    .sort((a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name))
}

function trendRowValue(row, suffixes) {
  const key = pickRowKey(row, suffixes)
  return key ? row[key] : undefined
}

function mapsFromTrendRows(rows) {
  const genres = new Map()
  const tags = new Map()
  let total = 0
  for (const row of rows || []) {
    const kind = trendRowValue(row, ['TrendReleaseCounts.kind'])
    const name = trendRowValue(row, ['TrendReleaseCounts.name']) || ''
    const count = Number(trendRowValue(row, ['TrendReleaseCounts.gameCount'])) || 0
    if (kind === 'total') total += count
    else if (kind === 'genre' && name) genres.set(name, count)
    else if (kind === 'tag' && name) tags.set(name, count)
  }
  return { genres, tags, total, rowCount: (rows || []).length }
}

async function queryPrecomputedTrendRows(dateRange, signal) {
  return queryCube({
    measures: ['TrendReleaseCounts.gameCount'],
    dimensions: ['TrendReleaseCounts.kind', 'TrendReleaseCounts.name'],
    timeDimensions: [{
      dimension: 'TrendReleaseCounts.releaseDate',
      dateRange
    }],
    order: [['TrendReleaseCounts.gameCount', 'desc']],
    limit: 10000
  }, 1, 1, { analytics: true, signal })
}

function topCountedNames(counts, limit) {
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name)
}

function seriesFromCountMaps(currentCounts, previousCounts, limit) {
  const names = [...new Set([
    ...topCountedNames(currentCounts, limit),
    ...topCountedNames(previousCounts, limit)
  ])]
  return names
    .map((name) => ({
      name,
      current: currentCounts.get(name) || 0,
      previous: previousCounts.get(name) || 0
    }))
    .filter((row) => row.current > 0 || row.previous > 0)
    .sort((a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name))
}

function withTagChange(row) {
  const current = row.current || 0
  const previous = row.previous || 0
  const delta = current - previous
  return {
    name: row.name,
    current,
    previous,
    delta,
    percent: previous > 0 ? (delta / previous) * 100 : null
  }
}

function tagChangeRows(currentCounts, previousCounts) {
  const names = new Set([...currentCounts.keys(), ...previousCounts.keys()])
  return [...names]
    .map((name) => withTagChange({
      name,
      current: currentCounts.get(name) || 0,
      previous: previousCounts.get(name) || 0
    }))
    .filter((row) => row.current > 0 || row.previous > 0)
}

function trendPayload(period, currentRange, previousRange, genres, tags, currentTotal, previousTotal, tagChanges = null) {
  const withShare = (rows) => rows.map((row) => ({
    ...row,
    currentShare: currentTotal > 0 ? (row.current / currentTotal) * 100 : 0,
    previousShare: previousTotal > 0 ? (row.previous / previousTotal) * 100 : 0
  }))
  const sharedTags = withShare(tags)
  return {
    period: {
      key: period.key,
      label: period.label,
      isCurrent: period.isCurrent,
      previousLabel: period.previousLabel || period.prevMonthLabel,
      range: currentRange,
      previousRange,
      compare: period.compare || 'previous',
      yearCompareAvailable: period.yearCompareAvailable !== false,
      compareToDate: Boolean(period.compareToDate),
      currentTotal,
      previousTotal
    },
    genres: withShare(genres),
    tags: sharedTags,
    tagChanges: tagChanges || sharedTags.map(withTagChange)
  }
}

function resolveTrendRanges(monthKey, range, compare) {
  if (Array.isArray(range) && range[0] && range[1]) {
    const ordered = range[0] <= range[1] ? [range[0], range[1]] : [range[1], range[0]]
    const yearCompareAvailable = rangeWithinOneYear(ordered)
    const compareMode = compare === 'year' && yearCompareAvailable ? 'year' : 'previous'
    return {
      period: {
        key: 'custom',
        label: 'Custom range',
        isCurrent: false,
        previousLabel: compareMode === 'year' ? 'Previous year' : 'Previous period',
        compare: compareMode,
        yearCompareAvailable,
        compareToDate: false
      },
      currentRange: ordered,
      previousRange: compareMode === 'year' ? samePeriodLastYear(ordered) : previousPeriodRange(ordered)
    }
  }

  const period = resolveTimeMachinePeriod(monthKey)
  const currentRange = period.range
  const compareMode = compare === 'year' ? 'year' : 'previous'
  const previousRange = compareMode === 'year'
    ? samePeriodLastYear(currentRange)
    : (period.isCurrent ? period.prevMonthToDateRange : period.prevMonthRange)
  return {
    period: {
      ...period,
      compare: compareMode,
      yearCompareAvailable: true,
      compareToDate: Boolean(period.isCurrent && compareMode === 'previous')
    },
    currentRange,
    previousRange
  }
}

/**
 * Genre and tag release counts for the selected month and the month before it.
 * The current calendar month is compared with the same elapsed days last month.
 * Counts come from trend_release_counts when that table is available.
 * @param {string} monthKey
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function getTrendAnalysis(monthKey = 'this-month', { signal = null, range = null, compare = 'previous' } = {}) {
  const { period, currentRange, previousRange } = resolveTrendRanges(monthKey, range, compare)

  try {
    const [currentRows, previousRows] = await Promise.all([
      queryPrecomputedTrendRows(currentRange, signal),
      queryPrecomputedTrendRows(previousRange, signal)
    ])
    const current = mapsFromTrendRows(currentRows)
    const previous = mapsFromTrendRows(previousRows)
    if (current.rowCount + previous.rowCount > 0) {
      return trendPayload(
        period,
        currentRange,
        previousRange,
        seriesFromCountMaps(current.genres, previous.genres, TREND_GENRE_LIMIT),
        seriesFromCountMaps(current.tags, previous.tags, TREND_TAG_LIMIT),
        current.total,
        previous.total,
        tagChangeRows(current.tags, previous.tags)
      )
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    console.warn('Precomputed trend counts unavailable, querying games directly:', error)
  }

  const [genres, tags, currentTotal, previousTotal] = await Promise.all([
    buildTrendSeries('Genres.name', currentRange, previousRange, TREND_GENRE_LIMIT, signal),
    buildTrendSeries('GameTags.tag', currentRange, previousRange, TREND_TAG_LIMIT, signal),
    queryCount('Games', 'count', currentRange, signal),
    queryCount('Games', 'count', previousRange, signal)
  ])

  return trendPayload(period, currentRange, previousRange, genres, tags, currentTotal, previousTotal)
}

/**
 * Search genres or tags that had releases in a date range.
 * @param {{ kind: 'genre' | 'tag', dateRange: [string, string], query: string, limit?: number, signal?: AbortSignal }} opts
 */
export async function searchStateOfSteamCategories({
  kind,
  dateRange,
  query,
  limit = 12,
  signal = null
} = {}) {
  const dimension = kind === 'tag' ? 'GameTags.tag' : 'Genres.name'
  const q = String(query || '').trim()
  if (!dateRange || dateRange.length !== 2 || !q) return []

  try {
    const rows = await queryCube({
      measures: ['TrendReleaseCounts.gameCount'],
      dimensions: ['TrendReleaseCounts.name'],
      timeDimensions: [{
        dimension: 'TrendReleaseCounts.releaseDate',
        dateRange
      }],
      order: [['TrendReleaseCounts.gameCount', 'desc']],
      filters: [
        { member: 'TrendReleaseCounts.kind', operator: 'equals', values: [kind === 'tag' ? 'tag' : 'genre'] },
        { member: 'TrendReleaseCounts.name', operator: 'contains', values: [q] }
      ],
      limit
    }, 1, 1, { analytics: true, signal })

    return (rows || [])
      .map((row) => ({
        name: trendRowValue(row, ['TrendReleaseCounts.name']) || '',
        count: Number(trendRowValue(row, ['TrendReleaseCounts.gameCount'])) || 0
      }))
      .filter((row) => row.name && row.count > 0)
  } catch (error) {
    if (isAbortError(error)) throw error
    console.warn('Precomputed category search unavailable, querying games directly:', error)
  }

  const rows = await queryCube({
    measures: ['Games.count'],
    dimensions: [dimension],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange
    }],
    order: [['Games.count', 'desc']],
    filters: [
      { member: dimension, operator: 'contains', values: [q] }
    ],
    limit
  }, 2, 1, { analytics: true, signal })

  return (rows || [])
    .map((row) => ({
      name: row[dimension] || '',
      count: Number(row['Games.count']) || 0
    }))
    .filter((row) => row.name && row.count > 0)
}

/**
 * Drill-down game list for State of Steam charts.
 * @param {{ dateRange: [string, string], day?: string, genre?: string, tag?: string, isFree?: boolean|null, limit?: number, signal?: AbortSignal }} opts
 */
export async function getStateOfSteamDrilldownGames({
  dateRange,
  day = null,
  genre = null,
  tag = null,
  isFree = null,
  limit = 200,
  signal = null
} = {}) {
  const range = day ? [day, day] : dateRange
  if (!range || range.length !== 2) {
    throw new Error('Drill-down requires a date range or day')
  }

  const filters = []
  if (genre) {
    filters.push({ member: 'Genres.name', operator: 'equals', values: [genre] })
  }
  if (tag) {
    filters.push({ member: 'GameTags.tag', operator: 'equals', values: [tag] })
  }
  if (isFree === true || isFree === false) {
    filters.push({ member: 'Games.isFree', operator: 'equals', values: [isFree] })
  }

  const query = {
    dimensions: [
      'Games.appId',
      'Games.name',
      'Games.releaseDate',
      'Games.reviewScoreDesc',
      'Games.isFree',
      'Games.totalReviewsValue'
    ],
    timeDimensions: [{
      dimension: 'Games.releaseDate',
      dateRange: range
    }],
    order: [
      ['Games.totalReviewsValue', 'desc'],
      ['Games.name', 'asc']
    ],
    limit
  }
  if (filters.length) query.filters = filters

  const rows = await queryCube(query, 2, 1, { analytics: true, signal })
  return (rows || [])
    .map((row) => ({
      appId: row['Games.appId'],
      name: row['Games.name'],
      releaseDate: row['Games.releaseDate']
        ? String(row['Games.releaseDate']).slice(0, 10)
        : null,
      reviewScoreDesc: row['Games.reviewScoreDesc'] || null,
      isFree: row['Games.isFree'] === true || row['Games.isFree'] === 'true',
      totalReviews: Number(row['Games.totalReviewsValue']) || 0
    }))
    .sort((a, b) => b.totalReviews - a.totalReviews || String(a.name || '').localeCompare(String(b.name || '')))
}

export default {
  getAllTags,
  searchTagsByName,
  getRecentTopGames,
  findGames,
  findDigMatches,
  getAppIdsForTag,
  getTagsForAppId,
  getAllGames,
  searchGamesByName,
  findSimilarGames,
  prefetchWarmNames,
  filterWarmNames,
  populateDailyCache,
  ensureDailyCache,
  resolveExcludedAppIds,
  getStateOfSteamMetrics,
  getStateOfSteamDrilldownGames,
  searchStateOfSteamCategories,
  getTrendAnalysis
}
