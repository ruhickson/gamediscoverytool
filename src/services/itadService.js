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

// Format price from ITAD API format [amount, currency] or price object
function formatPrice(priceData) {
  if (!priceData) return null
  
  // Handle array format [amount, currency]
  if (Array.isArray(priceData) && priceData.length >= 2) {
    const amount = priceData[0]
    const currency = priceData[1]
    const priceValue = typeof amount === 'number' ? amount / 100 : parseFloat(amount) / 100
    
    const currencySymbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥'
    }
    
    const symbol = currencySymbols[currency] || currency
    return `${symbol}${priceValue.toFixed(2)}`
  }
  
  // Handle object format { amount, amountInt, currency }
  if (typeof priceData === 'object' && priceData.amount !== undefined) {
    const priceValue = priceData.amountInt ? priceData.amountInt / 100 : priceData.amount
    const currency = priceData.currency || 'USD'
    
    const currencySymbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥'
    }
    
    const symbol = currencySymbols[currency] || currency
    return `${symbol}${priceValue.toFixed(2)}`
  }
  
  return null
}

// Fetch ITAD price for a game using their API
export async function fetchItadPrice(gameName, options = {}) {
  if (!gameName) {
    return { price: null, url: getItadUrl(gameName), error: 'No game name provided', loading: false }
  }

  // Check cache first
  const cacheKey = gameName.toLowerCase()
  const cached = priceCache.get(cacheKey)
  if (isCacheValid(cached)) {
    return { ...cached.data, loading: false }
  }

  const infoUrl = getItadUrl(gameName)

  try {
    // Use the same Netlify batch function for a single game to avoid deprecated endpoints/CORS
    const response = await axios.post(
      '/.netlify/functions/itad-price',
      { games: [gameName], country: options.country || 'US' },
      { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
    )

    const data = response.data?.data?.[gameName]

    if (data && data.price) {
      // Format price from the price object
      const priceObj = data.price
      const priceValue = priceObj.amount || (priceObj.amountInt ? priceObj.amountInt / 100 : 0)
      const currency = priceObj.currency || 'USD'
      
      const currencySymbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥'
      }
      
      const symbol = currencySymbols[currency] || currency
      const priceFormatted = priceValue > 0 ? `${symbol}${priceValue.toFixed(2)}` : null
      
      const result = {
        price: priceFormatted,
        url: priceObj.url || data.url || infoUrl,
        infoUrl: data.url || infoUrl,
        available: true,
        error: null,
        loading: false,
        shop: priceObj.shop || null
      }

      priceCache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    }

    const notFound = {
      price: null,
      url: data?.url || infoUrl,
      infoUrl: data?.url || infoUrl,
      available: false,
      error: 'Price not found',
      loading: false
    }
    priceCache.set(cacheKey, { data: notFound, timestamp: Date.now() - (CACHE_TTL_MS - 5 * 60 * 1000) })
    return notFound

  } catch (error) {
    console.warn(`Failed to fetch ITAD price for ${ gameName }:`, error.message)
    const result = {
      price: null,
      url: infoUrl,
      available: false,
      error: error.message || 'Failed to fetch price',
      loading: false
    }
    priceCache.set(cacheKey, { data: result, timestamp: Date.now() - (CACHE_TTL_MS - 5 * 60 * 1000) })
    return result
  }
}

// Fetch prices for multiple games using the new price API
export async function fetchItadPrices(gameNames, options = {}) {
  const { limit = null, country = 'US' } = options
  const names = limit ? gameNames.slice(0, limit) : gameNames
  
  if (names.length === 0) {
    return {}
  }

  // Batch fetch using the new price API endpoint
  try {
    const response = await axios.post(
      '/.netlify/functions/itad-price',
      {
        games: names,
        country: country
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    const apiResults = response.data.data || {}
    const results = {}

    // Transform API results to match expected format
    // Netlify function returns: { id, price: { amount, amountInt, currency, shop, url }, url }
    console.log('ITAD Service: Processing API results for', names.length, 'games')
    console.log('ITAD Service: API results:', apiResults)
    
    for (const gameName of names) {
      const apiData = apiResults[gameName]
      console.log(`ITAD Service: Processing ${gameName}:`, apiData)
      
      if (apiData && apiData.price) {
        // Format price from the price object
        // amount is already in dollars (e.g., 44.95), amountInt is in cents (e.g., 4495)
        const priceObj = apiData.price
        const priceValue = priceObj.amount || (priceObj.amountInt ? priceObj.amountInt / 100 : 0)
        const currency = priceObj.currency || 'USD'
        
        const currencySymbols = {
          'USD': '$',
          'EUR': '€',
          'GBP': '£',
          'JPY': '¥'
        }
        
        const symbol = currencySymbols[currency] || currency
        const priceFormatted = priceValue > 0 ? `${symbol}${priceValue.toFixed(2)}` : null
        
        console.log(`ITAD Service: Formatted price for ${gameName}:`, priceFormatted)
        
        results[gameName] = {
          price: priceFormatted,
          url: priceObj.url || apiData.url || getItadUrl(gameName),
          infoUrl: apiData.url || getItadUrl(gameName),
          available: true,
          error: null,
          loading: false,
          shop: priceObj.shop || null
        }
        
        // Cache the result
        const cacheKey = gameName.toLowerCase()
        priceCache.set(cacheKey, {
          data: results[gameName],
          timestamp: Date.now()
        })
      } else {
        // No price found
        console.log(`ITAD Service: No price data for ${gameName}`)
        results[gameName] = {
          price: null,
          url: apiData?.url || getItadUrl(gameName),
          infoUrl: apiData?.url || getItadUrl(gameName),
          available: false,
          error: 'Price not found',
          loading: false
        }
        
        // Cache error result for shorter time (5 minutes)
        const cacheKey = gameName.toLowerCase()
        priceCache.set(cacheKey, {
          data: results[gameName],
          timestamp: Date.now() - (CACHE_TTL_MS - 5 * 60 * 1000)
        })
      }
    }
    
    console.log('ITAD Service: Final results:', results)

    return results
  } catch (error) {
    console.warn('Error fetching ITAD prices in batch:', error.message)
    
    // Fallback to individual requests if batch fails
    const results = {}
    for (const gameName of names) {
      try {
        const priceData = await fetchItadPrice(gameName)
        results[gameName] = priceData
      } catch (err) {
        console.warn(`Error fetching ITAD price for ${gameName}:`, err)
        results[gameName] = {
          price: null,
          url: getItadUrl(gameName),
          available: false,
          error: err.message
        }
      }
    }
    
    return results
  }
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

