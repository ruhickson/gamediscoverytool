// API Proxy Service - Routes requests through backend to hide credentials
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Proxy methods that don't expose Cube.js credentials
export const proxyService = {
  // Get games with search
  async searchGames(query, options = {}) {
    try {
      const response = await apiClient.post('/search/games', {
        query,
        ...options
      })
      return response.data
    } catch (error) {
      console.error('Error searching games:', error)
      throw error
    }
  },

  // Get similar games
  async findSimilarGames(appId, minTags = 3) {
    try {
      const response = await apiClient.post('/search/similar', {
        appId,
        minTags
      })
      return response.data
    } catch (error) {
      console.error('Error finding similar games:', error)
      throw error
    }
  },

  // Get tags
  async searchTags(query, options = {}) {
    try {
      const response = await apiClient.post('/search/tags', {
        query,
        ...options
      })
      return response.data
    } catch (error) {
      console.error('Error searching tags:', error)
      throw error
    }
  },

  // Get games with filters
  async findGames(filters) {
    try {
      const response = await apiClient.post('/search/filtered', filters)
      return response.data
    } catch (error) {
      console.error('Error finding games:', error)
      throw error
    }
  }
}

export default proxyService
