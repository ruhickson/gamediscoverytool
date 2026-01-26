<template>
  <div class="game-finder">
    <!-- Filters Card -->
    <div class="card">
      <div 
        class="card-header d-flex justify-content-between align-items-center filters-header"
        @click="toggleFiltersCollapsed"
        :title="filtersCollapsed ? 'Click to expand filters' : 'Click to collapse filters'"
      >
        <div class="d-flex align-items-center gap-2">
          <h5 class="mb-0"><i class="fas fa-filter"></i> Filters</h5>
          <i :class="filtersCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up'"></i>
        </div>
        <button 
          class="btn btn-outline-light btn-sm" 
          @click.stop="copyCurrentUrl" 
          title="Copy shareable link"
        >
          <i class="fas fa-link me-1"></i> Share
        </button>
      </div>
      <div class="card-body" v-show="!filtersCollapsed">
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

        <!-- Section: Time Range -->

        <!-- Section: Reviews -->
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
              v-model.number="minReviews"
              min="0"
            >
          </div>
          <div class="col-md-4">
            <label for="maxReviewsFilter" class="form-label">Max Reviews</label>
            <input 
              type="number" 
              class="form-control" 
              id="maxReviewsFilter" 
              v-model.number="maxReviews"
              min="0"
            >
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label for="orderByFilter" class="form-label">Order Results By</label>
            <div class="btn-group mb-3 mt-2" role="group" aria-label="Order direction">
              <input type="radio" class="btn-check" name="orderDir" id="orderAsc" value="asc" v-model="orderDirection" @change="updateRouteFromFilters">
              <label class="btn btn-outline-secondary" for="orderAsc">ASC</label>
              <input type="radio" class="btn-check" name="orderDir" id="orderDesc" value="desc" v-model="orderDirection" @change="updateRouteFromFilters">
              <label class="btn btn-outline-secondary" for="orderDesc">DESC</label>
            </div>
            <select 
              id="orderByFilter" 
              class="form-select" 
              v-model="orderField"
              @change="updateRouteFromFilters"
            >
              <option value="release_date">Release Date</option>
              <option value="total_reviews">Total Reviews</option>
              <option value="review_score">Review Score</option>
              <option value="steam_score">Steam Review Score</option>
              <option value="game_name">Game Name</option>
            </select>
          </div>
          <div class="col-md-6">
            <label for="dateRange" class="form-label">Release Date Range</label>
            <div class="btn-group mb-3 mt-2" role="group" aria-label="Date mode toggle">
              <input type="radio" class="btn-check" name="dateMode" id="quickMode" value="quick" v-model="dateMode" @change="updateRouteFromFilters">
              <label class="btn btn-outline-secondary" for="quickMode">Quick</label>
              <input type="radio" class="btn-check" name="dateMode" id="customMode" value="custom" v-model="dateMode" @change="updateRouteFromFilters">
              <label class="btn btn-outline-secondary" for="customMode">Custom</label>
            </div>

            <div v-if="dateMode === 'quick'" class="mb-3">
              <select class="form-select quick-date-select" v-model="quickDateRange" @change="updateQuickDates">
                <option value="">Select a time period...</option>
                <option value="last3days">Last 3 days</option>
                <option value="lastweek">Last week</option>
                <option value="last2weeks">Last 2 weeks</option>
                <option value="lastmonth">Last month</option>
                <option value="last3months">Last 3 months</option>
                <option value="lastyear">Last year</option>
                <option value="last2years">Last 2 years</option>
                <option value="last3years">Last 3 years</option>
                <option value="last5years">Last 5 years</option>
                <option value="beginning">Beginning of time</option>
              </select>
            </div>

            <div v-if="dateMode === 'custom'" class="row">
              <div class="col-6">
                <input type="date" class="form-control" id="minDate" v-model="minDate" @change="updateRouteFromFilters">
                <label for="minDate" class="form-label-sm text-muted">From</label>
              </div>
              <div class="col-6">
                <input type="date" class="form-control" id="maxDate" v-model="maxDate" @change="updateRouteFromFilters">
                <label for="maxDate" class="form-label-sm text-muted">To</label>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter by hours directly beneath Release Date Range -->
        <div class="row mb-2">
          <div class="col-md-6">
            <div class="d-flex align-items-end gap-3">
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="hoursFilterEnabled" 
                  v-model="hoursFilterEnabled"
                  @change="updateRouteFromFilters"
                >
                <label class="form-check-label" for="hoursFilterEnabled">
                  Filter by hours
                </label>
              </div>
              <div class="flex-grow-0" style="min-width: 180px;">
                <label class="form-label">Condition</label>
                <select class="form-select" v-model="hoursComparator" :disabled="!hoursFilterEnabled" @change="updateRouteFromFilters">
                  <option value="at_least">At least</option>
                  <option value="at_most">At most</option>
                </select>
              </div>
              <div class="flex-grow-0" style="min-width: 160px;">
                <label class="form-label">Hours</label>
                <input type="number" class="form-control" v-model.number="hoursValue" min="0" step="1" :disabled="!hoursFilterEnabled" @change="updateRouteFromFilters">
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Toggles (buttons moved below include adult games) -->

        <!-- (hours controls moved above) -->

        <!-- Include Adult Games moved below Release Date Range -->
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="form-check" style="margin-top: 6px;">
              <input 
                class="form-check-input" 
                type="checkbox" 
                id="includeAdultGames" 
                v-model="includeAdultGames"
              >
              <label class="form-check-label" for="includeAdultGames">
                Include adult games
              </label>
              <div class="form-text text-muted">
                <small>By default, games with "Sexual Content" or "Hentai" tags are excluded</small>
              </div>
            </div>
            <div class="form-check" style="margin-top: 12px;">
              <input 
                class="form-check-input" 
                type="checkbox" 
                id="removeResultLimit" 
                v-model="removeResultLimit"
                @change="updateRouteFromFilters"
              >
              <label class="form-check-label" for="removeResultLimit">
                Remove limit of 100 results (warning: slower search)
              </label>
              <div class="form-text text-muted">
                <small>By default, results are limited to 100 games for faster loading and pricing</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="row mb-4 align-items-stretch">
          <div class="col-md-6 d-flex">
            <button 
              class="btn btn-primary w-100 py-5" 
              style="font-size: 1.25rem;"
              @click="searchGames"
              :disabled="isLoading"
            >
              <i class="fas fa-search me-2"></i>
              {{ isLoading ? 'Searching...' : 'Find Games' }}
            </button>
          </div>
          <div class="col-md-6 d-flex">
            <button 
              class="btn btn-secondary w-100 py-5" 
              style="font-size: 1.25rem;"
              @click="resetFilters"
            >
              <i class="fas fa-refresh me-2"></i>
              Reset Filters
            </button>
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
        <div v-if="games.length > 0 && !isLoading" class="d-flex gap-2">
          <button 
            class="btn btn-outline-light btn-sm" 
            @click="copyCurrentUrl"
            title="Copy link to this search"
          >
            <i class="fas fa-link me-1"></i> Share Search
          </button>
          <button 
            class="btn btn-outline-light btn-sm" 
            @click="exportResults"
            title="Copy top results to clipboard"
          >
            <i class="fas fa-copy me-1"></i> Export Results
          </button>
        </div>
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
                <th @click="sortBy('name')" class="sortable">
                  Game 
                  <i v-if="sortField === 'name'" :class="sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'"></i>
                  <i v-else class="fas fa-sort text-muted"></i>
                </th>
                <th>Share</th>
                <th @click="sortBy('reviewScoreDesc')" class="sortable">
                  Review Score 
                  <i v-if="sortField === 'reviewScoreDesc'" :class="sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'"></i>
                  <i v-else class="fas fa-sort text-muted"></i>
                </th>
                <th @click="sortBy('releaseDate')" class="sortable">
                  Release Date 
                  <i v-if="sortField === 'releaseDate'" :class="sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'"></i>
                  <i v-else class="fas fa-sort text-muted"></i>
                </th>
                <th @click="sortBy('scorePercent')" class="sortable">
                  Steam Review Score 
                  <i v-if="sortField === 'scorePercent'" :class="sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'"></i>
                  <i v-else class="fas fa-sort text-muted"></i>
                </th>
                <th @click="sortBy('totalReviews')" class="sortable">
                  Total Reviews 
                  <i v-if="sortField === 'totalReviews'" :class="sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'"></i>
                  <i v-else class="fas fa-sort text-muted"></i>
                </th>
                <th @click="sortBy('hours')" class="sortable">
                  Hours 
                  <i v-if="sortField === 'hours'" :class="sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'"></i>
                  <i v-else class="fas fa-sort text-muted"></i>
                </th>
                <th>ITAD Price</th>
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
                <td :class="{ 'hours-na': game.hours == null }">{{ game.hours != null ? formatNumber(game.hours) : 'N/A' }}</td>
                <td>
                  <a 
                    :href="game.itadUrl || getItadUrl(game.name)" 
                    target="_blank" 
                    class="itad-link"
                    :title="game.itadPrice ? `Current lowest price: ${game.itadPrice}${game.itadShop ? ' at ' + game.itadShop : ''}` : 'View on IsThereAnyDeal'"
                  >
                    {{ game.itadPrice || 'ITAD' }}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import cubeService from '../services/cubeService'
// Steam price hidden
import { getItadUrl } from '../services/itadService'
import axios from 'axios'

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
    // Ordering: separate field and direction, compute orderBy string when needed
    const orderField = ref('total_reviews')
    const orderDirection = ref('desc')
    const orderBy = computed(() => `${orderField.value}_${orderDirection.value}`)
    const minDate = ref('')
    const maxDate = ref('')
    const dateMode = ref('quick') // 'quick' or 'custom'
      const quickDateRange = ref('lastmonth')
      const includeAdultGames = ref(false)
      const removeResultLimit = ref(false)
      const hoursFilterEnabled = ref(false)
      const hoursComparator = ref('at_least')
      const hoursValue = ref(null)
      const games = ref([])
      const isLoading = ref(false)
      const error = ref('')
      const availableTags = ref([])
      // Steam price hidden; no price fetching
    
    // Sorting state
    const sortField = ref('')
    const sortDirection = ref('desc')
    
    // Tag selector state
    const tagSearchQuery = ref('')
    const excludeTagSearchQuery = ref('')
    const filteredTags = ref([])
    const filteredExcludeTags = ref([])
    const showTagDropdown = ref(false)
    const showExcludeTagDropdown = ref(false)
    
    // Filters collapse state
    const filtersCollapsed = ref(true)
    
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
            orderBy: orderBy.value || undefined,
            includeAdult: includeAdultGames.value ? '1' : undefined,
            removeLimit: removeResultLimit.value ? '1' : undefined,
            hoursEnabled: hoursFilterEnabled.value ? '1' : undefined,
            hoursCmp: hoursFilterEnabled.value ? hoursComparator.value : undefined,
            hoursVal: hoursFilterEnabled.value && hoursValue.value != null && hoursValue.value !== '' ? String(hoursValue.value) : undefined
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

    const toggleFiltersCollapsed = () => {
      filtersCollapsed.value = !filtersCollapsed.value
    }

    // Date range methods
    // Removed ITAD asynchronous fetching

    // Steam price fetching removed

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
        case 'last3months':
          minDate.value = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
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
          reviewScoreOrBetter: reviewScoreOrBetter.value,
          hours: hoursFilterEnabled.value ? { comparator: hoursComparator.value, value: hoursValue.value } : null
        }
        
        console.log('Search params minDate:', searchParams.minDate)
        console.log('Search params maxDate:', searchParams.maxDate)
        console.log('Date difference check:', searchParams.maxDate > searchParams.minDate)
        console.log('Search params reviewScore:', searchParams.reviewScore)
        console.log('Search params reviewScoreOrBetter:', searchParams.reviewScoreOrBetter)

        // Call the Cube.js service
        console.log('Calling findGames with params:', searchParams)
        let searchResults = await cubeService.findGames(searchParams)
        console.log('Search results received:', searchResults)
        console.log('Type:', typeof searchResults, 'Is array:', Array.isArray(searchResults))
        console.log('Length:', searchResults?.length)
        
        // Apply adult content filter if not including adult games
        if (!includeAdultGames.value) {
          console.log('Applying adult content filter')
          const adultContentTags = ['Sexual Content', 'Hentai']
          const adultExcludedAppIds = []
          
          for (const tag of adultContentTags) {
            try {
              const tagAppIds = await cubeService.getAppIdsForTag(tag)
              adultExcludedAppIds.push(...tagAppIds)
            } catch (err) {
              console.error(`Error getting app IDs for adult content tag ${tag}:`, err)
            }
          }
          
          // Also filter out games with problematic content descriptors
          try {
            const contentDescriptorAppIds = await cubeService.getAppIdsForContentDescriptors()
            adultExcludedAppIds.push(...contentDescriptorAppIds)
          } catch (err) {
            console.error('Error getting app IDs for content descriptors:', err)
          }
          
          const uniqueAdultExcludedAppIds = [...new Set(adultExcludedAppIds)]
          
          // Remove games with adult content tags or problematic content descriptors
          if (uniqueAdultExcludedAppIds.length > 0) {
            searchResults = searchResults.filter(game => 
              !uniqueAdultExcludedAppIds.includes(game['Games.appId'])
            )
            console.log('After adult content filter:', searchResults.length, 'games')
          }
        }
        
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
        console.log('Processing results, count:', searchResults.length)
        console.log('Sample raw game:', searchResults[0])
        let processedGames = searchResults.map(game => {
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
            totalReviews: game['Games.totalReviewsValue'] || 0,
            hours: game['Games.hours'] != null ? game['Games.hours'] : null
          }
        })
        console.log('Processed games count:', processedGames.length)
        console.log('Sample processed game:', processedGames[0])
        
        // Apply sorting
        if (!processedGames || processedGames.length === 0) {
          console.error('No processed games to sort!')
        }
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
        
        // Apply result limit (100) unless user opted to remove it
        if (!removeResultLimit.value && processedGames.length > 100) {
          console.log(`Limiting results from ${processedGames.length} to 100`)
          processedGames = processedGames.slice(0, 100)
        }
        
        console.log('About to assign games.value. processedGames.length:', processedGames.length)
        games.value = processedGames
        console.log('After assignment. games.value.length:', games.value.length)
        console.log('Search completed. Found', processedGames.length, 'games')
        
        // Fetch ITAD prices for each game individually after table loads
        // This happens asynchronously so the table shows immediately
        if (processedGames.length > 0) {
          // Detect user's country from browser locale
          const getUserCountry = () => {
            try {
              // navigator.language returns values like "en-US", "en-GB", "fr-FR"
              const locale = navigator.language || navigator.userLanguage || 'en-US'
              const countryCode = locale.split('-')[1] || 'US'
              return countryCode.toUpperCase()
            } catch {
              return 'US' // Default to US if detection fails
            }
          }
          
          const userCountry = getUserCountry()
          console.log(`Detected user country: ${userCountry}`)
          
          // Start fetching prices for each game in the background
          processedGames.forEach(async (game) => {
            try {
              console.log(`Fetching ITAD price for: ${game.name}`)
              
              // Step 1: Get game ID from game name using ITAD lookup API
              const lookupResponse = await axios.post(
                '/.netlify/functions/itad-lookup',
                { game: game.name },
                { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
              )
              
              console.log(`Lookup response for ${game.name}:`, lookupResponse.data)
              
              const gameId = lookupResponse.data?.id
              if (!gameId) {
                console.log(`No ITAD ID found for ${game.name}`)
                return
              }
              
              console.log(`Found ITAD ID for ${game.name}: ${gameId}`)
              
              // Step 2: Get prices using game ID with user's country
              const pricesResponse = await axios.post(
                '/.netlify/functions/itad-prices',
                { id: gameId, country: userCountry.toLowerCase() },
                { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
              )
              
              console.log(`Prices response for ${game.name}:`, pricesResponse.data)
              
              const priceData = pricesResponse.data?.price
              if (priceData && priceData.amount) {
                // Format price: amount is already in dollars (e.g., 44.95)
                const currency = priceData.currency || 'USD'
                const currencySymbols = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥' }
                const symbol = currencySymbols[currency] || currency
                const formattedPrice = `${symbol}${priceData.amount.toFixed(2)}`
                
                console.log(`Formatted price for ${game.name}: ${formattedPrice}`)
                
                // Update the game in the games array
                const gameIndex = games.value.findIndex(g => g.appId === game.appId)
                if (gameIndex !== -1) {
                  games.value[gameIndex] = {
                    ...games.value[gameIndex],
                    itadPrice: formattedPrice,
                    itadUrl: priceData.url || `https://isthereanydeal.com/game/${gameId}/info/`,
                    itadShop: priceData.shop
                  }
                  console.log(`Updated price for ${game.name} in games array`)
                }
              } else {
                console.log(`No price data for ${game.name}`)
              }
            } catch (err) {
              console.error(`Error fetching ITAD price for ${game.name}:`, err)
              console.error('Error details:', err.response?.data || err.message)
              // Continue without price for this game
            }
          })
        }
        
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
      includeAdultGames.value = false
      removeResultLimit.value = false
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
        'Total Reviews',
        'Hours',
        'ITAD Price',
        'ITAD Price URL'
      ]
      
      // Create CSV rows
      const rows = games.value.map(game => {
        const price = game.itadPrice || 'N/A'
        const priceUrl = game.itadUrl || getItadUrl(game.name)
        return [
          `"${game.name}"`,
          game.appId,
          `https://store.steampowered.com/app/${game.appId}`,
          game.reviewScoreDesc,
          formatDate(game.releaseDate),
          game.scorePercent || 'N/A',
          game.totalReviews,
          game.hours != null ? game.hours : 'N/A',
          price,
          priceUrl
        ]
      })
      
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
      const timeRangeText = getTimeRangeDescription()
      const gameList = first10Games.map(game => {
        const steamLink = `https://store.steampowered.com/app/${game.appId}`
        const scoreText = game.scorePercent ? `${game.scorePercent}%` : 'N/A'
        const reviewsText = game.totalReviews.toLocaleString()
        return `${game.name} - ${steamLink} - ${scoreText} - ${reviewsText} reviews`
      }).join('\n')
      
      const shareLines = [
        `I found these ${tagsText} games ${timeRangeText} using https://gamediscoverytool.com :`,
        '',
        gameList,
        '',
        `Recreate Search: ${window.location.href}`
      ]
      const shareText = shareLines.join('\n')
      
      navigator.clipboard.writeText(shareText).then(() => {
        showCopyMessage('Results exported and copied!')
      }).catch(() => {
        showCopyMessage('Results exported!')
      })
    }

    const getTimeRangeDescription = () => {
      if (dateMode.value === 'quick') {
        const quickMap = {
          last3days: 'over the last 3 days',
          lastweek: 'over the last week',
          last2weeks: 'over the last 2 weeks',
          lastmonth: 'over the last month',
          last3months: 'over the last 3 months',
          lastyear: 'over the last year',
          last2years: 'over the last 2 years',
          last3years: 'over the last 3 years',
          last5years: 'over the last 5 years',
          beginning: 'since the beginning of time'
        }
        if (quickDateRange.value && quickMap[quickDateRange.value]) {
          return quickMap[quickDateRange.value]
        }
        return 'recently'
      }

      const hasMin = !!minDate.value
      const hasMax = !!maxDate.value
      if (hasMin && hasMax) {
        return `between ${formatDate(minDate.value)} and ${formatDate(maxDate.value)}`
      }
      if (hasMin) {
        return `since ${formatDate(minDate.value)}`
      }
      if (hasMax) {
        return `up to ${formatDate(maxDate.value)}`
      }
      return 'recently'
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

    const sortBy = (field) => {
      if (sortField.value === field) {
        // Toggle direction if same field
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      } else {
        // New field, default to descending
        sortField.value = field
        sortDirection.value = 'desc'
      }
      
      // Sort the games array
      games.value.sort((a, b) => {
        let aVal = a[field]
        let bVal = b[field]
        
        // Handle different data types
        if (field === 'releaseDate') {
          aVal = aVal ? new Date(aVal) : new Date(0)
          bVal = bVal ? new Date(bVal) : new Date(0)
        } else if (field === 'scorePercent' || field === 'totalReviews' || field === 'hours') {
          aVal = aVal || 0
          bVal = bVal || 0
        } else if (field === 'name' || field === 'reviewScoreDesc') {
          aVal = (aVal || '').toString()
          bVal = (bVal || '').toString()
        }
        
        let comparison = 0
        if (aVal < bVal) comparison = -1
        else if (aVal > bVal) comparison = 1
        
        return sortDirection.value === 'asc' ? comparison : -comparison
      })
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
          if (q.orderBy) {
            const ob = String(q.orderBy)
            const match = ob.match(/^(.*)_(asc|desc)$/)
            if (match) {
              orderField.value = match[1]
              orderDirection.value = match[2]
            }
          }
          includeAdultGames.value = q.includeAdult === '1'
          removeResultLimit.value = q.removeLimit === '1'
          // Hours filter
          hoursFilterEnabled.value = q.hoursEnabled === '1'
          if (q.hoursCmp === 'at_least' || q.hoursCmp === 'at_most') hoursComparator.value = String(q.hoursCmp)
          if (q.hoursVal) hoursValue.value = parseInt(q.hoursVal, 10)
        }

        // Load tags first
        await loadTags()

        // If URL has filters, run a search; else load recent top games with fallback
        if (Object.keys(q).length) {
          await searchGames()
        } else {
          // Use includeAdultGames value from URL if present, otherwise default to false (exclude adult games)
          const recentGames = await cubeService.getRecentTopGames(100, includeAdultGames.value)
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
                totalReviews: game['Games.totalReviewsValue'] || 0,
                length: game['Games.length'] || null
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
      orderField,
      orderDirection,
      orderBy,
      includeAdultGames,
      removeResultLimit,
      hoursFilterEnabled,
      hoursComparator,
      hoursValue
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
      includeAdultGames,
      removeResultLimit,
      hoursFilterEnabled,
      hoursComparator,
      hoursValue,
      updateQuickDates,
      games,
      isLoading,
      error,
      availableTags,
      orderField,
      orderDirection,
      
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
      getItadUrl,
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
      showCopyMessage,
      sortBy,
      sortField,
      sortDirection,
      filtersCollapsed,
      toggleFiltersCollapsed
    }
  }
}
</script>

<style scoped>
/* Filters collapse animation */
.card-body {
  transition: opacity 0.2s ease, max-height 0.3s ease;
  overflow: hidden;
}

.filters-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.filters-header:hover {
  background-color: var(--color-bg) !important;
}

/* Table styling - no horizontal scroll on desktop, enable on mobile */
.table-responsive {
  width: 100%;
  overflow-x: visible;
}

.table-responsive table {
  width: 100%;
  table-layout: fixed;
}

/* Enable horizontal scroll on mobile devices */
@media (max-width: 768px) {
  .table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .table-responsive table {
    table-layout: auto;
    min-width: 800px;
  }
}

/* All table cells except game name should not wrap */
.table-responsive th,
.table-responsive td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Game name column - allow wrapping with max-width */
.table-responsive th:nth-child(1),
.table-responsive td:nth-child(1) {
  width: 25%;
  max-width: 300px;
  white-space: normal;
  word-wrap: break-word;
}

.table-responsive th:nth-child(2),
.table-responsive td:nth-child(2) {
  width: 5%;
  min-width: 50px;
}

.table-responsive th:nth-child(3),
.table-responsive td:nth-child(3) {
  width: 12%;
  min-width: 100px;
}

.table-responsive th:nth-child(4),
.table-responsive td:nth-child(4) {
  width: 10%;
  min-width: 90px;
}

.table-responsive th:nth-child(5),
.table-responsive td:nth-child(5) {
  width: 15%;
  min-width: 120px;
}

.table-responsive th:nth-child(6),
.table-responsive td:nth-child(6) {
  width: 10%;
  min-width: 90px;
}

.table-responsive th:nth-child(7),
.table-responsive td:nth-child(7) {
  width: 8%;
  min-width: 70px;
}

.table-responsive th:nth-child(8),
.table-responsive td:nth-child(8) {
  width: 10%;
  min-width: 90px;
}
</style>
