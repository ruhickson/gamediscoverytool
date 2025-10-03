/**
 * Algolia-style client-side search engine for game discovery
 * No database queries - uses pre-built index files
 */

// Search configuration
const SEARCH_CONFIG = {
  maxResults: 100,
  debounceMs: 200,
  minQueryLength: 2,
  fuzzyThreshold: 0.6,
  exactMatchBoost: 2.0,
  prefixMatchBoost: 1.5,
  popularityBoost: 1.2
}

// In-memory search index
let searchIndex = null
let indexLoaded = false
let loadingPromise = null

/**
 * Load the search index from the static file
 */
async function loadSearchIndex() {
  if (indexLoaded && searchIndex) {
    return searchIndex
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = (async () => {
    try {
      console.log('Loading search index...')
      const response = await fetch('/games-index.json')
      
      if (!response.ok) {
        throw new Error(`Failed to load search index: ${response.status}`)
      }

      const indexData = await response.json()
      
      // Validate index structure
      if (!Array.isArray(indexData.games)) {
        throw new Error('Invalid index format: games array missing')
      }

      searchIndex = {
        games: indexData.games,
        lastUpdated: indexData.lastUpdated,
        totalGames: indexData.games.length
      }

      indexLoaded = true
      console.log(`Search index loaded: ${searchIndex.totalGames} games`)
      
      return searchIndex
    } catch (error) {
      console.error('Failed to load search index:', error)
      // Return empty index as fallback
      searchIndex = { games: [], lastUpdated: null, totalGames: 0 }
      indexLoaded = true
      return searchIndex
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

/**
 * Normalize search term for consistent matching
 */
function normalizeTerm(term) {
  return (term || '').toLowerCase().trim().replace(/[^\w\s]/g, '')
}

/**
 * Calculate fuzzy match score using Levenshtein distance
 */
function calculateFuzzyScore(query, target) {
  const queryNorm = normalizeTerm(query)
  const targetNorm = normalizeTerm(target)
  
  if (queryNorm === targetNorm) {
    return 1.0 // Exact match
  }
  
  if (targetNorm.startsWith(queryNorm)) {
    return 0.9 // Prefix match
  }
  
  if (targetNorm.includes(queryNorm)) {
    return 0.8 // Substring match
  }
  
  // Levenshtein distance calculation
  const distance = levenshteinDistance(queryNorm, targetNorm)
  const maxLength = Math.max(queryNorm.length, targetNorm.length)
  
  if (maxLength === 0) return 0
  
  return 1 - (distance / maxLength)
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Calculate popularity score based on review count and rating
 */
function calculatePopularityScore(game) {
  let score = 0
  
  // Review count factor (logarithmic scale)
  if (game.totalReviews && game.totalReviews > 0) {
    score += Math.log10(game.totalReviews + 1) * 10
  }
  
  // Review score factor
  if (game.reviewScore) {
    const scoreMap = {
      'Overwhelmingly Positive': 100,
      'Very Positive': 80,
      'Mostly Positive': 60,
      'Positive': 40,
      'Mixed': 20,
      'Mostly Negative': 10,
      'Negative': 5,
      'Very Negative': 2,
      'Overwhelmingly Negative': 1
    }
    score += scoreMap[game.reviewScore] || 0
  }
  
  return Math.min(score, 100) // Cap at 100
}

/**
 * Rank search results by relevance and popularity
 */
function rankResults(query, games) {
  const queryNorm = normalizeTerm(query)
  
  return games
    .map(game => {
      let score = 0
      
      // Fuzzy match score
      const fuzzyScore = calculateFuzzyScore(query, game.name)
      if (fuzzyScore < SEARCH_CONFIG.fuzzyThreshold) {
        return null // Filter out low-relevance results
      }
      
      // Base relevance score
      score += fuzzyScore * 100
      
      // Exact match boost
      if (normalizeTerm(game.name) === queryNorm) {
        score *= SEARCH_CONFIG.exactMatchBoost
      }
      
      // Prefix match boost
      if (normalizeTerm(game.name).startsWith(queryNorm)) {
        score *= SEARCH_CONFIG.prefixMatchBoost
      }
      
      // Popularity boost
      const popularityScore = calculatePopularityScore(game)
      score += popularityScore * SEARCH_CONFIG.popularityBoost
      
      return {
        ...game,
        _searchScore: score,
        _fuzzyScore: fuzzyScore,
        _popularityScore: popularityScore
      }
    })
    .filter(game => game !== null) // Remove filtered results
    .sort((a, b) => b._searchScore - a._searchScore) // Sort by relevance
    .slice(0, SEARCH_CONFIG.maxResults) // Limit results
}

/**
 * Main search function - Algolia-style interface
 */
export async function searchGames(query, options = {}) {
  const {
    limit = SEARCH_CONFIG.maxResults,
    minQueryLength = SEARCH_CONFIG.minQueryLength
  } = options

  // Validate query
  if (!query || query.trim().length < minQueryLength) {
    return []
  }

  // Load index if not already loaded
  const index = await loadSearchIndex()
  
  if (!index || index.games.length === 0) {
    console.warn('Search index not available')
    return []
  }

  // Perform search
  const results = rankResults(query, index.games)
  
  // Clean up internal scoring fields
  return results.slice(0, limit).map(game => {
    const { _searchScore, _fuzzyScore, _popularityScore, ...cleanGame } = game
    return cleanGame
  })
}

/**
 * Get search suggestions (for autocomplete)
 */
export async function getSearchSuggestions(query, limit = 10) {
  const results = await searchGames(query, { limit })
  
  // Return just names for suggestions
  return results.map(game => ({
    name: game.name,
    appId: game.appId
  }))
}

/**
 * Check if search index is loaded and fresh
 */
export async function isIndexReady() {
  try {
    const index = await loadSearchIndex()
    return index && index.games.length > 0
  } catch (error) {
    return false
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats() {
  try {
    const index = await loadSearchIndex()
    return {
      totalGames: index.totalGames,
      lastUpdated: index.lastUpdated,
      isLoaded: indexLoaded
    }
  } catch (error) {
    return {
      totalGames: 0,
      lastUpdated: null,
      isLoaded: false
    }
  }
}

/**
 * Preload search index (for better UX)
 */
export async function preloadIndex() {
  return loadSearchIndex()
}

// Export configuration for external use
export { SEARCH_CONFIG }
