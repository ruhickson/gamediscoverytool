/**
 * Steam Price Service
 * Fetches current game prices from Steam Store API
 */

// Cache for price data to avoid excessive API calls
const priceCache = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_SIZE = 1000

/**
 * Get cached price data if still valid
 */
function getCachedPrice(appId) {
  const cached = priceCache.get(appId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  return null
}

/**
 * Cache price data
 */
function setCachedPrice(appId, data) {
  // Clean up old entries if cache is full
  if (priceCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = priceCache.keys().next().value
    if (oldestKey) {
      priceCache.delete(oldestKey)
    }
  }
  
  priceCache.set(appId, {
    timestamp: Date.now(),
    data: data
  })
}

/**
 * Format price from cents to currency string
 */
function formatPrice(priceInCents, currency = 'USD') {
  if (priceInCents === 0) {
    return 'Free'
  }
  
  const price = priceInCents / 100
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'C$',
    'AUD': 'A$'
  }
  
  const symbol = currencySymbols[currency] || currency
  return `${symbol}${price.toFixed(2)}`
}

/**
 * Fetch price information for a single game from Steam Store API
 */
async function fetchGamePrice(appId) {
  try {
    console.log(`Fetching price for appId: ${appId}`)
    // Prefer proxy to avoid CORS
    const cc = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_STEAM_CC) ? import.meta.env.VITE_STEAM_CC : 'us'
    const lang = 'en'
    let response = await fetch(`/.netlify/functions/steam-price?appids=${appId}&cc=${cc}&l=${lang}`)
    if (!response.ok) {
      // Fallback to direct (may fail due to CORS in browser)
      response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${cc}&l=${lang}`)
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!data[appId] || !data[appId].success) {
      throw new Error(`Game not found or API error for appId: ${appId}`)
    }
    
    const gameData = data[appId].data
    
    // Check if game has pricing information
    if (!gameData.price_overview) {
      return {
        appId: appId,
        isFree: gameData.is_free || false,
        price: gameData.is_free ? 'Free' : 'N/A',
        originalPrice: null,
        discountPercent: 0,
        currency: (gameData.price_overview && gameData.price_overview.currency) || 'USD',
        available: true
      }
    }
    
    const priceOverview = gameData.price_overview
    
    return {
      appId: appId,
      isFree: gameData.is_free || false,
      price: formatPrice(priceOverview.final, priceOverview.currency),
      originalPrice: priceOverview.initial !== priceOverview.final ? 
        formatPrice(priceOverview.initial, priceOverview.currency) : null,
      discountPercent: priceOverview.discount_percent || 0,
      currency: priceOverview.currency,
      available: true
    }
    
  } catch (error) {
    console.warn(`Failed to fetch price for appId ${appId}:`, error.message)
    return {
      appId: appId,
      isFree: false,
      price: 'N/A',
      originalPrice: null,
      discountPercent: 0,
      currency: 'USD',
      available: false,
      error: error.message
    }
  }
}

/**
 * Fetch prices for multiple games with rate limiting
 */
async function fetchMultipleGamePrices(appIds, delayMs = 100) {
  const results = []
  
  for (let i = 0; i < appIds.length; i++) {
    const appId = appIds[i]
    
    // Check cache first
    const cached = getCachedPrice(appId)
    if (cached) {
      results.push(cached)
      continue
    }
    
    // Fetch price
    const priceData = await fetchGamePrice(appId)
    setCachedPrice(appId, priceData)
    results.push(priceData)
    
    // Rate limiting - wait between requests
    if (i < appIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  return results
}

/**
 * Get price for a single game (with caching)
 */
export async function getGamePrice(appId) {
  // Check cache first
  const cached = getCachedPrice(appId)
  if (cached) {
    return cached
  }
  
  // Fetch and cache
  const priceData = await fetchGamePrice(appId)
  setCachedPrice(appId, priceData)
  return priceData
}

/**
 * Get prices for multiple games
 */
export async function getGamePrices(appIds, options = {}) {
  const { 
    delayMs = 100, // Delay between requests in ms
    maxConcurrent = 5 // Maximum concurrent requests
  } = options
  
  if (!Array.isArray(appIds) || appIds.length === 0) {
    return []
  }
  
  // Filter out already cached items
  const uncachedIds = appIds.filter(id => !getCachedPrice(id))
  const cachedResults = appIds.map(id => getCachedPrice(id)).filter(Boolean)
  
  // Fetch uncached items
  let fetchedResults = []
  if (uncachedIds.length > 0) {
    console.log(`Fetching prices for ${uncachedIds.length} games...`)
    fetchedResults = await fetchMultipleGamePrices(uncachedIds, delayMs)
  }
  
  // Combine cached and fetched results
  const allResults = [...cachedResults, ...fetchedResults]
  
  // Return in the same order as input appIds
  return appIds.map(appId => 
    allResults.find(result => result.appId === appId)
  )
}

/**
 * Clear price cache
 */
export function clearPriceCache() {
  priceCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: priceCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS
  }
}

export default {
  getGamePrice,
  getGamePrices,
  clearPriceCache,
  getCacheStats
}

