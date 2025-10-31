// ITAD (IsThereAnyDeal) Service - Fetches game prices
import axios from 'axios'

// Cache for ITAD prices (game name -> price data)
const priceCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour cache

// Helper function to sanitize game name for ITAD URL
export function getItadUrl(gameName) {
  if (!gameName) return 'https://isthereanydeal.com/'
  // Remove special characters, replace spaces with hyphens, lowercase
  const sanitized = gameName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces (including multiple) with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
  return `https://isthereanydeal.com/game/${sanitized}/info/`
}

// Helper function to get game slug for API
function getGameSlug(gameName) {
  if (!gameName) return ''
  return gameName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Check if cached data is still valid
function isCacheValid(cachedData) {
  if (!cachedData) return false
  return Date.now() - cachedData.timestamp < CACHE_TTL_MS
}

// Format price from ITAD API format [amount, currency]
function formatPrice(priceArray) {
  if (!Array.isArray(priceArray) || priceArray.length < 2) return null
  const amount = priceArray[0]
  const currency = priceArray[1]
  
  // Convert from cents to currency units (divide by 100)
  const priceValue = typeof amount === 'number' ? amount / 100 : parseFloat(amount) / 100
  
  // Format based on currency
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥'
  }
  
  const symbol = currencySymbols[currency] || currency
  return `${symbol}${priceValue.toFixed(2)}`
}

// Fetch ITAD price for a game using their API
export async function fetchItadPrice(gameName) {
  if (!gameName) {
    return { price: null, url: getItadUrl(gameName), error: 'No game name provided', loading: false }
  }

  // Check cache first
  const cacheKey = gameName.toLowerCase()
  const cached = priceCache.get(cacheKey)
  if (isCacheValid(cached)) {
    return { ...cached.data, loading: false }
  }

  const gameSlug = getGameSlug(gameName)
  // Prefer proxy to avoid CORS in browser; fall back to direct URL if needed
  const proxyUrl = `/.netlify/functions/itad-info?game=${encodeURIComponent(gameSlug)}`
  const directUrl = `https://isthereanydeal.com/api/game/info/?game=${encodeURIComponent(gameSlug)}`
  const infoUrl = getItadUrl(gameName)
  
  try {
    let response
    try {
      response = await axios.get(proxyUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      })
    } catch (proxyError) {
      // Fallback to direct call (may be blocked by CORS in browser)
      response = await axios.get(directUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
      })
    }

    const data = response.data
    
    // Extract best price and related fields
    let price = null
    let bestUrl = infoUrl
    let historyLow = null
    if (data?.stats?.best?.price) {
      price = formatPrice(data.stats.best.price)
    }
    if (data?.stats?.best?.url) {
      bestUrl = data.stats.best.url
    }
    if (data?.stats?.history?.all?.price) {
      historyLow = formatPrice(data.stats.history.all.price)
    }

    const result = {
      price: price,
      url: bestUrl,
      infoUrl, // keep reference to info page
      available: price !== null,
      error: price === null ? 'Price not found' : null,
      loading: false,
      historyLow
    }

    // Cache the result
    priceCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })

    return result

  } catch (error) {
    console.warn(`Failed to fetch ITAD price for ${gameName}:`, error.message)
    
    // Check if it's a CORS error - we might need a backend proxy
    const isCorsError = error.message.includes('CORS') || 
                        error.message.includes('cross-origin') ||
                        (error.response === undefined && error.request !== undefined)
    
    const result = {
      price: null,
      url: infoUrl,
      available: false,
      error: isCorsError 
        ? 'CORS error - backend proxy may be required'
        : error.message || 'Failed to fetch price',
      loading: false
    }

    // Cache error result for shorter time (5 minutes)
    priceCache.set(cacheKey, {
      data: result,
      timestamp: Date.now() - (CACHE_TTL_MS - 5 * 60 * 1000) // Cache for 5 minutes on error
    })

    return result
  }
}

// Fetch prices for multiple games with rate limiting
export async function fetchItadPrices(gameNames, options = {}) {
  const { delayMs = 200, limit = null } = options
  const names = limit ? gameNames.slice(0, limit) : gameNames
  const results = {}

  for (let i = 0; i < names.length; i++) {
    const gameName = names[i]
    
    // Rate limit: wait before making next request (except first)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    try {
      const priceData = await fetchItadPrice(gameName)
      results[gameName] = priceData
    } catch (error) {
      console.warn(`Error fetching ITAD price for ${gameName}:`, error)
      results[gameName] = {
        price: null,
        url: getItadUrl(gameName),
        available: false,
        error: error.message
      }
    }
  }

  return results
}

// Clear the price cache
export function clearItadCache() {
  priceCache.clear()
}

export default {
  getItadUrl,
  fetchItadPrice,
  fetchItadPrices,
  clearItadCache
}

