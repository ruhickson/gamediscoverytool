<template>
  <div class="game-finder">
    <!-- Filters Card -->
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0"><i class="fas fa-filter"></i> Filters</h5>
        <button class="btn btn-outline-light btn-sm" @click="copyCurrentUrl" title="Copy shareable link">
          <i class="fas fa-link me-1"></i> Share
        </button>
      </div>
      <div class="card-body">
        <p class="text-muted fst-italic">Please wait for the 'Tags' dropdown to populate before searching.</p>
        
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="tagFilter" class="form-label">Tags</label>
            <div class="tag-selector">
              <div class="tag-input-container">
                <input 
                  type="text" 
                  class="form-control tag-search-input" 
                  v-model="tagSearchQuery"
                  @input="filterTags"
                  @keydown.enter.prevent="addTagFromSearch"
                  @keydown.escape="clearTagSearch"
                  placeholder="Type to search tags..."
                  :disabled="isLoading"
                >
                <div class="tag-dropdown" v-if="showTagDropdown && filteredTags.length > 0">
                  <div 
                    v-for="tag in filteredTags.slice(0, 10)" 
                    :key="tag"
                    class="tag-option"
                    @click="addTag(tag)"
                    :class="{ 'tag-option-selected': selectedTags.includes(tag) }"
                  >
                    {{ tag }}
                    <span v-if="selectedTags.includes(tag)" class="tag-selected-indicator">✓</span>
                  </div>
                </div>
              </div>
              <div class="selected-tags" v-if="selectedTags.length > 0">
                <span 
                  v-for="tag in selectedTags" 
                  :key="tag" 
                  class="tag-badge"
                >
                  {{ tag }}
                  <button 
                    type="button" 
                    class="tag-remove" 
                    @click="removeTag(tag)"
                    title="Remove tag"
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <label for="excludeTagFilter" class="form-label">Exclude Tags</label>
            <div class="tag-selector">
              <div class="tag-input-container">
                <input 
                  type="text" 
                  class="form-control tag-search-input" 
                  v-model="excludeTagSearchQuery"
                  @input="filterExcludeTags"
                  @keydown.enter.prevent="addExcludeTagFromSearch"
                  @keydown.escape="clearExcludeTagSearch"
                  placeholder="Type to search tags to exclude..."
                  :disabled="isLoading"
                >
                <div class="tag-dropdown" v-if="showExcludeTagDropdown && filteredExcludeTags.length > 0">
                  <div 
                    v-for="tag in filteredExcludeTags.slice(0, 10)" 
                    :key="tag"
                    class="tag-option"
                    @click="addExcludeTag(tag)"
                    :class="{ 'tag-option-selected': excludeTags.includes(tag) }"
                  >
                    {{ tag }}
                    <span v-if="excludeTags.includes(tag)" class="tag-selected-indicator">✓</span>
                  </div>
                </div>
              </div>
              <div class="selected-tags" v-if="excludeTags.length > 0">
                <span 
                  v-for="tag in excludeTags" 
                  :key="tag" 
                  class="tag-badge exclude-tag"
                >
                  {{ tag }}
                  <button 
                    type="button" 
                    class="tag-remove" 
                    @click="removeExcludeTag(tag)"
                    title="Remove exclude tag"
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-4">
            <div class="d-flex align-items-center gap-3">
              <div class="flex-grow-1">
                <label for="reviewScoreFilter" class="form-label">Review Score</label>
                <select 
                  id="reviewScoreFilter" 
                  class="form-select" 
                  v-model="reviewScore"
                >
                  <option value="Any">Any</option>
                  <option value="Overwhelmingly Positive">Overwhelmingly Positive</option>
                  <option value="Very Positive">Very Positive</option>
                  <option value="Mostly Positive">Mostly Positive</option>
                  <option value="Positive">Positive</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Mostly Negative">Mostly Negative</option>
                  <option value="Negative">Negative</option>
                  <option value="Very Negative">Very Negative</option>
                  <option value="Overwhelmingly Negative">Overwhelmingly Negative</option>
                </select>
              </div>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="reviewScoreOrBetter" 
                  v-model="reviewScoreOrBetter"
                >
                <label class="form-check-label" for="reviewScoreOrBetter">
                  or better
                </label>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <label for="minReviewsFilter" class="form-label">Min Reviews</label>
            <input 
              type="number" 
              class="form-control" 
              id="minReviewsFilter" 
              v-model="minReviews"
              min="0"
            >
          </div>
          <div class="col-md-4">
            <label for="maxReviewsFilter" class="form-label">Max Reviews</label>
            <input 
              type="number" 
              class="form-control" 
              id="maxReviewsFilter" 
              v-model="maxReviews"
              min="0"
            >
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label for="orderByFilter" class="form-label">Order Results By</label>
            <select 
              id="orderByFilter" 
              class="form-select" 
              v-model="orderBy"
            >
              <option value="release_date_desc">Release Date (Newest First)</option>
              <option value="release_date_asc">Release Date (Oldest First)</option>
              <option value="total_reviews_desc">Total Reviews (Most First)</option>
              <option value="total_reviews_asc">Total Reviews (Least First)</option>
              <option value="review_score_desc">Review Score (Best First)</option>
              <option value="review_score_asc">Review Score (Worst First)</option>
              <option value="steam_score_desc">Steam Review Score (Highest First)</option>
              <option value="steam_score_asc">Steam Review Score (Lowest First)</option>
              <option value="game_name_asc">Game Name (A-Z)</option>
              <option value="game_name_desc">Game Name (Z-A)</option>
            </select>
          </div>
          <div class="col-md-6">
            <div style="margin-top: 25px;">
              <p class="text-muted small">Choose how to sort the search results</p>
            </div>
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label for="dateRange" class="form-label">Release Date Range</label>
            
            <!-- Date Mode Toggle -->
            <div class="btn-group mb-3" role="group" aria-label="Date mode toggle">
              <input 
                type="radio" 
                class="btn-check" 
                name="dateMode" 
                id="quickMode" 
                value="quick"
                v-model="dateMode"
                @change="updateRouteFromFilters"
              >
              <label class="btn btn-outline-secondary" for="quickMode">Quick</label>

              <input 
                type="radio" 
                class="btn-check" 
                name="dateMode" 
                id="customMode" 
                value="custom"
                v-model="dateMode"
                @change="updateRouteFromFilters"
              >
              <label class="btn btn-outline-secondary" for="customMode">Custom</label>
            </div>

            <!-- Quick Date Options -->
            <div v-if="dateMode === 'quick'" class="mb-3">
              <select 
                class="form-select quick-date-select" 
                v-model="quickDateRange"
                @change="updateQuickDates"
              >
                <option value="">Select a time period...</option>
                <option value="last3days">Last 3 days</option>
                <option value="lastweek">Last week</option>
                <option value="last2weeks">Last 2 weeks</option>
                <option value="lastmonth">Last month</option>
                <option value="lastyear">Last year</option>
                <option value="last2years">Last 2 years</option>
                <option value="last3years">Last 3 years</option>
                <option value="last5years">Last 5 years</option>
                <option value="beginning">Beginning of time</option>
              </select>
            </div>

            <!-- Custom Date Range -->
            <div v-if="dateMode === 'custom'" class="row">
              <div class="col-6">
                <input 
                  type="date" 
                  class="form-control" 
                  id="minDate" 
                  v-model="minDate"
                  @change="updateRouteFromFilters"
                >
                <label for="minDate" class="form-label-sm text-muted">From</label>
              </div>
              <div class="col-6">
                <input 
                  type="date" 
                  class="form-control" 
                  id="maxDate" 
                  v-model="maxDate"
                  @change="updateRouteFromFilters"
                >
                <label for="maxDate" class="form-label-sm text-muted">To</label>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div style="margin-top: 25px;">
              <button 
                class="btn btn-primary w-100" 
                @click="searchGames"
                :disabled="isLoading"
              >
                <i class="fas fa-search me-2"></i>
                {{ isLoading ? 'Searching...' : 'Find Games' }}
              </button>
            </div>
          </div>
          <div class="col-md-3">
            <div style="margin-top: 25px;">
              <button 
                class="btn btn-secondary w-100" 
                @click="resetFilters"
              >
                <i class="fas fa-refresh me-2"></i>
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-12">
            <p class="text-muted small mt-2">
              Note: Coming soon games are automatically excluded from all results.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Results Card -->
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0"><i class="fas fa-list"></i> Search Results</h5>
        <button 
          v-if="games.length > 0 && !isLoading" 
          class="btn btn-outline-light btn-sm" 
          @click="exportResults"
          title="Export results to CSV"
        >
          <i class="fas fa-download me-1"></i> Export Results
        </button>
      </div>
      <div class="card-body">
        <div v-if="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
          <p>Searching for games...</p>
        </div>
        
        <div v-else-if="error" class="error">
          {{ error }}
        </div>
        
        <div v-else-if="games.length === 0" class="text-center text-muted py-4">
          <i class="fas fa-gamepad fa-3x mb-3"></i>
          <p>No games found. Try adjusting your search criteria.</p>
        </div>
        
        <div v-else class="table-responsive">
          <table class="table table-striped table-hover">
            <thead>
              <tr>
                <th>Game</th>
                <th>Share</th>
                <th>Review Score</th>
                <th>Release Date</th>
                <th>Steam Review Score</th>
                <th>Total Reviews</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in games" :key="game.appId">
                <td>
                  <a 
                    :href="`https://store.steampowered.com/app/${game.appId}`" 
                    target="_blank" 
                    class="game-link"
                  >
                    {{ game.name }}
                  </a>
                </td>
                <td>
                  <a 
                    href="#" 
                    class="share-btn" 
                    @click.prevent="shareGame(game)"
                    title="Share this game"
                  >
                    🔗
                  </a>
                </td>
                <td>{{ game.reviewScoreDesc }}</td>
                <td>{{ formatDate(game.releaseDate) }}</td>
                <td>
                  <div class="steam-score-bar" :class="getScoreClass(game.scorePercent)">
                    <div 
                      v-if="game.scorePercent !== null" 
                      class="steam-score-fill" 
                      :style="{ width: game.scorePercent + '%' }"
                    >
                      {{ game.scorePercent }}%
                    </div>
                    <span v-else>N/A</span>
                  </div>
                </td>
                <td>{{ formatNumber(game.totalReviews) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import cubeService from '../services/cubeService'

export default {
  name: 'GameFinder',
  setup() {
    // Router for deep-linking filters
    const route = useRoute()
    const router = useRouter()
    // Reactive data
    const selectedTags = ref([])
    const excludeTags = ref([])
    const reviewScore = ref('Positive')
    const reviewScoreOrBetter = ref(true)
    const minReviews = ref(11)
    const maxReviews = ref(10000)
    const orderBy = ref('total_reviews_desc')
    const minDate = ref('')
    const maxDate = ref('')
    const dateMode = ref('quick') // 'quick' or 'custom'
    const quickDateRange = ref('lastmonth')
    const games = ref([])
    const isLoading = ref(false)
    const error = ref('')
    const availableTags = ref([])
    
    // Tag selector state
    const tagSearchQuery = ref('')
    const excludeTagSearchQuery = ref('')
    const filteredTags = ref([])
    const filteredExcludeTags = ref([])
    const showTagDropdown = ref(false)
    const showExcludeTagDropdown = ref(false)
    
    // Debounce timers
    let tagSearchTimeout = null
    let excludeTagSearchTimeout = null

    // Initialize dates with quick mode default
    const today = new Date()
    const oneMonthAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000))
    minDate.value = oneMonthAgo.toISOString().split('T')[0]
    maxDate.value = today.toISOString().split('T')[0]

    // Methods
    const parseArrayParam = (val) => {
      if (!val) return []
      if (Array.isArray(val)) return val.filter(Boolean)
      return String(val).split(',').map(v => v.trim()).filter(Boolean)
    }

    const updateRouteFromFilters = (() => {
      let t
      return () => {
        if (t) clearTimeout(t)
        t = setTimeout(() => {
          const query = {
            tags: selectedTags.value.length ? selectedTags.value.join(',') : undefined,
            exclude: excludeTags.value.length ? excludeTags.value.join(',') : undefined,
            reviewScore: reviewScore.value !== 'Any' ? reviewScore.value : undefined,
            orBetter: reviewScoreOrBetter.value ? '1' : undefined,
            minReviews: minReviews.value != null ? String(minReviews.value) : undefined,
            maxReviews: maxReviews.value != null ? String(maxReviews.value) : undefined,
            dateMode: dateMode.value || undefined,
            quickDateRange: quickDateRange.value || undefined,
            minDate: minDate.value || undefined,
            maxDate: maxDate.value || undefined,
            orderBy: orderBy.value || undefined
          }
          Object.keys(query).forEach(k => query[k] === undefined && delete query[k])
          router.replace({ name: 'GameFinder', query }).catch(() => {})
        }, 200)
      }
    })()
    const loadTags = async () => {
      try {
        isLoading.value = true
        const tagsData = await cubeService.getAllTags()
        availableTags.value = tagsData.map(tag => tag['all_tags.name']).filter(Boolean)
      } catch (err) {
        console.error('Error loading tags:', err)
        error.value = 'Failed to load tags. Please check your connection.'
        // Fallback to empty array
        availableTags.value = []
      } finally {
        isLoading.value = false
      }
    }

    // Tag selector methods
    const filterTags = () => {
      // Clear previous timeout
      if (tagSearchTimeout) {
        clearTimeout(tagSearchTimeout)
      }

      // Debounce search by 300ms
      tagSearchTimeout = setTimeout(async () => {
        if (tagSearchQuery.value.trim() === '') {
          // Show first 20 tags when no search
          filteredTags.value = availableTags.value.slice(0, 20)
          showTagDropdown.value = false
        } else {
          try {
            // Use client-side search for tags
            const results = await cubeService.searchTagsByName(tagSearchQuery.value, 20)
            filteredTags.value = results
            showTagDropdown.value = true
          } catch (error) {
            console.error('Error filtering tags:', error)
            // Fallback to local filtering
            const query = tagSearchQuery.value.toLowerCase()
            filteredTags.value = availableTags.value.filter(tag => 
              tag.toLowerCase().includes(query)
            )
            showTagDropdown.value = true
          }
        }
      }, 300)
    }

    const filterExcludeTags = () => {
      // Clear previous timeout
      if (excludeTagSearchTimeout) {
        clearTimeout(excludeTagSearchTimeout)
      }

      // Debounce search by 300ms
      excludeTagSearchTimeout = setTimeout(async () => {
        if (excludeTagSearchQuery.value.trim() === '') {
          // Show first 20 tags when no search
          filteredExcludeTags.value = availableTags.value.slice(0, 20)
          showExcludeTagDropdown.value = false
        } else {
          try {
            // Use client-side search for tags
            const results = await cubeService.searchTagsByName(excludeTagSearchQuery.value, 20)
            filteredExcludeTags.value = results
            showExcludeTagDropdown.value = true
          } catch (error) {
            console.error('Error filtering exclude tags:', error)
            // Fallback to local filtering
            const query = excludeTagSearchQuery.value.toLowerCase()
            filteredExcludeTags.value = availableTags.value.filter(tag => 
              tag.toLowerCase().includes(query)
            )
            showExcludeTagDropdown.value = true
          }
        }
      }, 300)
    }

    const addTag = (tag) => {
      if (!selectedTags.value.includes(tag)) {
        selectedTags.value.push(tag)
      }
      tagSearchQuery.value = ''
      showTagDropdown.value = false
    }

    const addExcludeTag = (tag) => {
      if (!excludeTags.value.includes(tag)) {
        excludeTags.value.push(tag)
      }
      excludeTagSearchQuery.value = ''
      showExcludeTagDropdown.value = false
    }

    const removeTag = (tag) => {
      const index = selectedTags.value.indexOf(tag)
      if (index > -1) {
        selectedTags.value.splice(index, 1)
      }
    }

    const removeExcludeTag = (tag) => {
      const index = excludeTags.value.indexOf(tag)
      if (index > -1) {
        excludeTags.value.splice(index, 1)
      }
    }

    const addTagFromSearch = () => {
      if (tagSearchQuery.value.trim() && filteredTags.value.length > 0) {
        addTag(filteredTags.value[0])
      }
    }

    const addExcludeTagFromSearch = () => {
      if (excludeTagSearchQuery.value.trim() && filteredExcludeTags.value.length > 0) {
        addExcludeTag(filteredExcludeTags.value[0])
      }
    }

    const clearTagSearch = () => {
      tagSearchQuery.value = ''
      showTagDropdown.value = false
    }

    const clearExcludeTagSearch = () => {
      excludeTagSearchQuery.value = ''
      showExcludeTagDropdown.value = false
    }

    // Date range methods
    const updateQuickDates = () => {
      const today = new Date()
      
      switch (quickDateRange.value) {
        case 'last3days':
          minDate.value = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'lastweek':
          minDate.value = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'last2weeks':
          minDate.value = new Date(today.getTime() - (14 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'lastmonth':
          minDate.value = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'lastyear':
          minDate.value = new Date(today.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'last2years':
          minDate.value = new Date(today.getTime() - (2 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'last3years':
          minDate.value = new Date(today.getTime() - (3 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'last5years':
          minDate.value = new Date(today.getTime() - (5 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          maxDate.value = today.toISOString().split('T')[0]
          break
        case 'beginning':
          minDate.value = '1900-01-01' // Very early date
          maxDate.value = today.toISOString().split('T')[0]
          break
        default:
          minDate.value = ''
          maxDate.value = ''
      }
      
      updateRouteFromFilters()
    }

    const searchGames = async () => {
      isLoading.value = true
      error.value = ''
      
      try {
        // Sync URL for shareable searches
        updateRouteFromFilters()

        // Prepare search parameters
        const searchParams = {
          tags: selectedTags.value.length > 0 ? selectedTags.value : null,
          reviewScore: reviewScore.value,
          minReviews: minReviews.value,
          maxReviews: maxReviews.value,
          minDate: minDate.value,
          maxDate: maxDate.value,
          reviewScoreOrBetter: reviewScoreOrBetter.value
        }

        console.log('Search parameters:', searchParams)
        
        // Call the Cube.js service
        let searchResults = await cubeService.findGames(searchParams)
        
        // Apply exclude tags filter if any are selected
        if (excludeTags.value.length > 0) {
          console.log('Applying exclude tags filter')
          const excludedAppIds = []
          
          for (const tag of excludeTags.value) {
            try {
              const tagAppIds = await cubeService.getAppIdsForTag(tag)
              excludedAppIds.push(...tagAppIds)
            } catch (err) {
              console.error(`Error getting app IDs for exclude tag ${tag}:`, err)
            }
          }
          
          const uniqueExcludedAppIds = [...new Set(excludedAppIds)]
          
          // Remove games with excluded tags
          if (uniqueExcludedAppIds.length > 0) {
            searchResults = searchResults.filter(game => 
              !uniqueExcludedAppIds.includes(game['Games.appId'])
            )
            console.log('After exclude tags filter:', searchResults.length, 'games')
          }
        }
        
        // Process the results
        const processedGames = searchResults.map(game => {
          // Calculate Steam score percentage
          const positiveReviews = game['Games.totalPositiveReviews'] || 0
          const negativeReviews = game['Games.totalNegativeReviews'] || 0
          const totalReviews = positiveReviews + negativeReviews
          
          let scorePercent = null
          if (totalReviews > 0) {
            scorePercent = Math.round((positiveReviews / totalReviews) * 100 * 10) / 10
          }
          
          return {
            appId: game['Games.appId'],
            name: game['Games.name'],
            reviewScoreDesc: game['Games.reviewScoreDesc'],
            releaseDate: game['Games.releaseDate'],
            scorePercent: scorePercent,
            totalReviews: game['Games.totalReviewsValue'] || 0
          }
        })
        
        // Apply sorting
        processedGames.sort((a, b) => {
          switch (orderBy.value) {
            case 'release_date_desc':
              return (b.releaseDate || new Date(0)) - (a.releaseDate || new Date(0))
            case 'release_date_asc':
              return (a.releaseDate || new Date(0)) - (b.releaseDate || new Date(0))
            case 'review_score_desc':
              return (b.scorePercent || 0) - (a.scorePercent || 0)
            case 'review_score_asc':
              return (a.scorePercent || 0) - (b.scorePercent || 0)
            case 'steam_score_desc':
              return (b.scorePercent || 0) - (a.scorePercent || 0)
            case 'steam_score_asc':
              return (a.scorePercent || 0) - (b.scorePercent || 0)
            case 'total_reviews_desc':
              return b.totalReviews - a.totalReviews
            case 'total_reviews_asc':
              return a.totalReviews - b.totalReviews
            case 'game_name_asc':
              return (a.name || '').localeCompare(b.name || '')
            case 'game_name_desc':
              return (b.name || '').localeCompare(a.name || '')
            default:
              return 0
          }
        })
        
        games.value = processedGames
        console.log('Search completed. Found', processedGames.length, 'games')
        
      } catch (err) {
        console.error('Search error:', err)
        if (err.message.includes('timeout') || err.message.includes('Continue wait')) {
          error.value = 'The search query is taking too long to process. Please try simplifying your search criteria or try again later.'
        } else if (err.message.includes('Cube.js returned an error')) {
          error.value = 'The database is currently busy processing complex queries. Please try again later.'
        } else {
          error.value = 'An error occurred while searching for games. Please check your connection and try again.'
        }
      } finally {
        isLoading.value = false
      }
    }

    const resetFilters = () => {
      selectedTags.value = []
      excludeTags.value = []
      reviewScore.value = 'Positive'
      reviewScoreOrBetter.value = true
      minReviews.value = 11
      maxReviews.value = 10000
      orderBy.value = 'total_reviews_desc'
      dateMode.value = 'quick'
      quickDateRange.value = 'lastmonth'
      minDate.value = oneMonthAgo.toISOString().split('T')[0]
      maxDate.value = today.toISOString().split('T')[0]
      games.value = []
      error.value = ''
    }

    const shareGame = (game) => {
      const gameLink = `https://store.steampowered.com/app/${game.appId}`
      const shareText = `I found ${game.name} (${gameLink}) using https://gamediscoverytool.com`
      
      navigator.clipboard.writeText(shareText).then(() => {
        showCopyMessage()
      }).catch(() => {
        showCopyMessage('Failed to copy')
      })
    }

    const showCopyMessage = (message = 'Copied!') => {
      // Create a temporary toast element
      const toast = document.createElement('div')
      toast.textContent = message
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--steam-blue);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s ease;
      `
      
      document.body.appendChild(toast)
      
      // Remove the toast after 2 seconds
      setTimeout(() => {
        toast.style.opacity = '0'
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast)
          }
        }, 300)
      }, 2000)
    }

    const copyCurrentUrl = () => {
      const url = window.location.href
      navigator.clipboard.writeText(url).then(() => {
        showCopyMessage('Copied')
      }).catch(() => {
        showCopyMessage('Failed to copy')
      })
    }

    const exportResults = () => {
      if (games.value.length === 0) return
      
      // Create CSV headers
      const headers = [
        'Game Name',
        'App ID',
        'Steam URL',
        'Review Score',
        'Release Date',
        'Steam Review Score (%)',
        'Total Reviews'
      ]
      
      // Create CSV rows
      const rows = games.value.map(game => [
        `"${game.name}"`,
        game.appId,
        `https://store.steampowered.com/app/${game.appId}`,
        game.reviewScoreDesc,
        formatDate(game.releaseDate),
        game.scorePercent || 'N/A',
        game.totalReviews
      ])
      
      // Combine headers and rows
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `game_search_results_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Also copy formatted list to clipboard
      const first10Games = games.value.slice(0, 10)
      const tagsText = selectedTags.value.length > 0 ? selectedTags.value.join(', ') : 'filtered'
      const gameList = first10Games.map(game => {
        const steamLink = `https://store.steampowered.com/app/${game.appId}`
        const scoreText = game.scorePercent ? `${game.scorePercent}%` : 'N/A'
        const reviewsText = game.totalReviews.toLocaleString()
        return `${game.name} - ${steamLink} - ${scoreText} - ${reviewsText} reviews`
      }).join('\n')
      
      const shareText = `I found these ${tagsText} games using https://gamediscoverytool.com:\n\n${gameList}`
      
      navigator.clipboard.writeText(shareText).then(() => {
        showCopyMessage('Results exported and copied!')
      }).catch(() => {
        showCopyMessage('Results exported!')
      })
    }

    const formatDate = (date) => {
      if (!date) return 'N/A'
      if (typeof date === 'string') {
        return new Date(date).toLocaleDateString()
      }
      return date.toLocaleDateString()
    }

    const formatNumber = (num) => {
      return num.toLocaleString()
    }

    const getScoreClass = (score) => {
      if (score === null || score === undefined) return 'na'
      if (score >= 90) return 'score-90'
      if (score >= 80) return 'score-80'
      if (score >= 70) return 'score-70'
      if (score >= 60) return 'score-60'
      if (score >= 40) return 'score-40'
      return 'score-low'
    }

    // Load initial data
    const loadInitialData = async () => {
      try {
        isLoading.value = true
        error.value = ''

        // Initialize daily cache for fast searches
        cubeService.ensureDailyCache().catch(() => {})

        // Hydrate from URL query if present
        const q = route.query || {}
        if (Object.keys(q).length) {
          selectedTags.value = parseArrayParam(q.tags)
          excludeTags.value = parseArrayParam(q.exclude)
          if (q.reviewScore) reviewScore.value = String(q.reviewScore)
          reviewScoreOrBetter.value = q.orBetter === '1' ? true : (q.orBetter === '0' ? false : reviewScoreOrBetter.value)
          if (q.minReviews) minReviews.value = parseInt(q.minReviews, 10) || minReviews.value
          if (q.maxReviews) maxReviews.value = parseInt(q.maxReviews, 10) || maxReviews.value
          if (q.dateMode) dateMode.value = String(q.dateMode)
          if (q.quickDateRange) quickDateRange.value = String(q.quickDateRange)
          if (q.minDate) minDate.value = String(q.minDate)
          if (q.maxDate) maxDate.value = String(q.maxDate)
          if (q.orderBy) orderBy.value = String(q.orderBy)
        }

        // Load tags first
        await loadTags()

        // If URL has filters, run a search; else load recent top games with fallback
        if (Object.keys(q).length) {
          await searchGames()
        } else {
          const recentGames = await cubeService.getRecentTopGames(100)
          if (recentGames && recentGames.length > 0) {
            const processedGames = recentGames.map(game => {
              const positiveReviews = game['Games.totalPositiveReviews'] || 0
              const negativeReviews = game['Games.totalNegativeReviews'] || 0
              const totalReviews = positiveReviews + negativeReviews
              let scorePercent = null
              if (totalReviews > 0) {
                scorePercent = Math.round((positiveReviews / totalReviews) * 100 * 10) / 10
              }
              return {
                appId: game['Games.appId'],
                name: game['Games.name'],
                reviewScoreDesc: game['Games.reviewScoreDesc'],
                releaseDate: game['Games.releaseDate'],
                scorePercent: scorePercent,
                totalReviews: game['Games.totalReviewsValue'] || 0
              }
            })
            processedGames.sort((a, b) => {
              const reviewsCompare = b.totalReviews - a.totalReviews
              if (reviewsCompare !== 0) return reviewsCompare
              const scoreOrder = [
                'Overwhelmingly Positive', 'Very Positive', 'Mostly Positive', 'Positive',
                'Mixed', 'Negative', 'Mostly Negative', 'Very Negative', 'Overwhelmingly Negative'
              ]
              const scoreA = scoreOrder.indexOf(a.reviewScoreDesc) || 999
              const scoreB = scoreOrder.indexOf(b.reviewScoreDesc) || 999
              return scoreA - scoreB
            })
            games.value = processedGames
            console.log('Initial data loaded. Found', processedGames.length, 'games')
          } else {
            console.log('No initial games loaded, user can search manually')
            games.value = []
          }
        }

      } catch (err) {
        console.error('Error loading initial data:', err)
        error.value = 'Failed to load initial data. You can still search for games manually.'
        games.value = []
      } finally {
        isLoading.value = false
      }
    }

    // Lifecycle
    onMounted(() => {
      loadInitialData()
    })

    // Keep URL in sync with filters for shareable links
    watch([
      selectedTags,
      excludeTags,
      reviewScore,
      reviewScoreOrBetter,
      minReviews,
      maxReviews,
      minDate,
      maxDate,
      dateMode,
      quickDateRange,
      orderBy
    ], updateRouteFromFilters, { deep: true })

    return {
      selectedTags,
      excludeTags,
      reviewScore,
      reviewScoreOrBetter,
      minReviews,
      maxReviews,
      orderBy,
      minDate,
      maxDate,
      dateMode,
      quickDateRange,
      updateQuickDates,
      games,
      isLoading,
      error,
      availableTags,
      tagSearchQuery,
      excludeTagSearchQuery,
      filteredTags,
      filteredExcludeTags,
      showTagDropdown,
      showExcludeTagDropdown,
      searchGames,
      resetFilters,
      copyCurrentUrl,
      shareGame,
      exportResults,
      formatDate,
      formatNumber,
      getScoreClass,
      filterTags,
      filterExcludeTags,
      addTag,
      addExcludeTag,
      removeTag,
      removeExcludeTag,
      addTagFromSearch,
      addExcludeTagFromSearch,
      clearTagSearch,
      clearExcludeTagSearch,
      showCopyMessage
    }
  }
}
</script>

<style scoped>

/* Quick Date Select Dropdown Styling */
.quick-date-select {
  background-color: #2d2d2d !important;
  border-color: #4d4d4d !important;
  color: #e0e0e0 !important;
}

.quick-date-select:focus {
  background-color: #2d2d2d !important;
  border-color: #6c757d !important;
  color: #e0e0e0 !important;
  box-shadow: 0 0 0 0.2rem rgba(108, 117, 125, 0.25) !important;
}

.quick-date-select option {
  background-color: #2d2d2d !important;
  color: #e0e0e0 !important;
}

.quick-date-select option:hover {
  background-color: #4d4d4d !important;
}

/* Override Bootstrap form-select styling for dark theme */
.form-select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23e0e0e0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 6 7 7 7-7'/%3e%3c/svg%3e") !important;
  position: relative !important;
}

/* Remove any decorative elements from form selects */
.form-select::before,
.form-select::after {
  display: none !important;
  content: none !important;
}

/* Override any pixel art styling that might add decorative elements */
.form-select {
  background: #2d2d2d !important;
  border: 1px solid #4d4d4d !important;
  color: #e0e0e0 !important;
  font-family: inherit !important;
  font-size: 14px !important;
  text-transform: none !important;
  box-shadow: none !important;
}

.quick-date-select {
  background: #2d2d2d !important;
  border: 1px solid #4d4d4d !important;
  color: #e0e0e0 !important;
  font-family: inherit !important;
  font-size: 14px !important;
  text-transform: none !important;
  box-shadow: none !important;
}

/* Fix dropdown animations and prevent wave effects */
.tag-dropdown, .game-dropdown {
  animation: none !important;
  transition: none !important;
}

.tag-dropdown *, .game-dropdown * {
  animation: none !important;
  transition: none !important;
}

/* Ensure dropdowns are stable */
.tag-option, .game-option {
  animation: none !important;
  transition: none !important;
  transform: none !important;
}

/* Override any Bootstrap dropdown animations */
.dropdown-menu {
  animation: none !important;
  transition: none !important;
}

.dropdown-menu * {
  animation: none !important;
  transition: none !important;
}
</style>
