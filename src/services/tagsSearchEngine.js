/**
 * Client-side search engine for tags
 * No database queries - uses pre-built index files
 */

// Search configuration
const TAGS_SEARCH_CONFIG = {
  maxResults: 100,
  debounceMs: 200,
  minQueryLength: 1,
  fuzzyThreshold: 0.6,
  exactMatchBoost: 2.0,
  prefixMatchBoost: 1.5
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
      console.log('Loading tags search index...')
      const response = await fetch('/tags-index.json')
      
      if (!response.ok) {
        throw new Error(`Failed to load tags index: ${response.status}`)
      }

      const indexData = await response.json()
      
      // Validate index structure
      if (!Array.isArray(indexData.tags)) {
        throw new Error('Invalid index format: tags array missing')
      }

      searchIndex = {
        tags: indexData.tags,
        lastUpdated: indexData.lastUpdated,
        totalTags: indexData.tags.length
      }

      indexLoaded = true
      console.log(`Tags search index loaded: ${searchIndex.totalTags} tags`)
      
      return searchIndex
    } catch (error) {
      console.error('Failed to load tags search index:', error)
      // Return empty index as fallback
      searchIndex = { tags: [], lastUpdated: null, totalTags: 0 }
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
 * Calculate fuzzy match score using simple string matching
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
  
  return 0
}

/**
 * Rank search results by relevance
 */
function rankResults(query, tags) {
  const queryNorm = normalizeTerm(query)
  
  return tags
    .map(tag => {
      let score = 0
      
      // Fuzzy match score
      const fuzzyScore = calculateFuzzyScore(query, tag.name)
      if (fuzzyScore < TAGS_SEARCH_CONFIG.fuzzyThreshold) {
        return null // Filter out low-relevance results
      }
      
      // Base relevance score
      score += fuzzyScore * 100
      
      // Exact match boost
      if (normalizeTerm(tag.name) === queryNorm) {
        score *= TAGS_SEARCH_CONFIG.exactMatchBoost
      }
      
      // Prefix match boost
      if (normalizeTerm(tag.name).startsWith(queryNorm)) {
        score *= TAGS_SEARCH_CONFIG.prefixMatchBoost
      }
      
      return {
        ...tag,
        _searchScore: score,
        _fuzzyScore: fuzzyScore
      }
    })
    .filter(tag => tag !== null) // Remove filtered results
    .sort((a, b) => b._searchScore - a._searchScore) // Sort by relevance
    .slice(0, TAGS_SEARCH_CONFIG.maxResults) // Limit results
}

/**
 * Main search function - client-side search for tags
 */
export async function searchTags(query, options = {}) {
  const {
    limit = TAGS_SEARCH_CONFIG.maxResults,
    minQueryLength = TAGS_SEARCH_CONFIG.minQueryLength
  } = options

  // Validate query
  if (!query || query.trim().length < minQueryLength) {
    return []
  }

  // Load index if not already loaded
  const index = await loadSearchIndex()
  
  if (!index || index.tags.length === 0) {
    console.warn('Tags search index not available')
    return []
  }

  // Perform search
  const results = rankResults(query, index.tags)
  
  // Clean up internal scoring fields
  return results.slice(0, limit).map(tag => {
    const { _searchScore, _fuzzyScore, ...cleanTag } = tag
    return cleanTag
  })
}

/**
 * Get search suggestions (for autocomplete)
 */
export async function getTagSuggestions(query, limit = 10) {
  const results = await searchTags(query, { limit })
  
  // Return just names for suggestions
  return results.map(tag => tag.name)
}

/**
 * Check if search index is loaded and fresh
 */
export async function isIndexReady() {
  try {
    const index = await loadSearchIndex()
    return index && index.tags.length > 0
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
      totalTags: index.totalTags,
      lastUpdated: index.lastUpdated,
      isLoaded: indexLoaded
    }
  } catch (error) {
    return {
      totalTags: 0,
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
export { TAGS_SEARCH_CONFIG }
