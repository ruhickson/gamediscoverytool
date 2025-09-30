<template>
  <div class="recommender">
    <!-- Game Search Card -->
    <div class="card">
      <div class="card-header">
        <h5><i class="fas fa-search"></i> Find Similar Games</h5>
      </div>
      <div class="card-body">
        <div class="row mb-3">
          <div class="col-md-8">
            <label for="gameSearch" class="form-label">Search for a Game</label>
            <div class="game-search-container">
              <div class="position-relative">
                <input 
                  type="text" 
                  class="form-control" 
                  id="gameSearch" 
                  v-model="gameSearchQuery"
                  @input="searchGames"
                  placeholder="Type at least 3 characters to search for games..."
                  :disabled="isLoading"
                >
                <div v-if="isSearching" class="search-loading-indicator">
                  <i class="fas fa-spinner fa-spin"></i>
                </div>
              </div>
              <div v-if="showGameDropdown && filteredGames.length > 0" class="game-dropdown">
                <div 
                  v-for="game in filteredGames" 
                  :key="game.appId"
                  class="game-option"
                  @click="selectGame(game)"
                >
                  {{ game.name }}
                  <span class="game-app-id">({{ game.appId }})</span>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div style="margin-top: 25px;">
              <button 
                class="btn btn-primary w-100" 
                @click="findSimilarGames"
                :disabled="!selectedGame || isLoading"
              >
                <i class="fas fa-magic me-2"></i>
                {{ isLoading ? 'Finding...' : 'Find Similar Games' }}
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="selectedGame" class="selected-game-info">
          <div class="alert alert-info">
            <strong>Selected Game:</strong> {{ selectedGame.name }} ({{ selectedGame.appId }})
            <button 
              type="button" 
              class="btn-close float-end" 
              @click="clearSelection"
              aria-label="Clear selection"
            ></button>
          </div>
          
          <!-- Tighten/Loosen Controls -->
          <div class="row mb-3">
            <div class="col-12">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <label class="form-label mb-1">Similarity Filter</label>
                  <small class="text-muted">Minimum {{ minCommonTags }} common tags required</small>
                </div>
                <div class="btn-group" role="group">
                  <button 
                    class="btn btn-outline-primary btn-sm" 
                    @click="loosenResults"
                    :disabled="minCommonTags <= 5"
                    title="Loosen results (lower minimum tags)"
                  >
                    <i class="fas fa-expand-arrows-alt me-1"></i>
                    Loosen
                  </button>
                  <button 
                    class="btn btn-outline-primary btn-sm" 
                    @click="tightenResults"
                    :disabled="minCommonTags >= 20"
                    title="Tighten results (higher minimum tags)"
                  >
                    <i class="fas fa-compress-arrows-alt me-1"></i>
                    Tighten
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="card">
      <div class="card-body text-center py-5">
        <div class="loading-spinner mb-3">
          <i class="fas fa-spinner fa-spin fa-3x text-primary"></i>
        </div>
        <h5>Finding Similar Games...</h5>
        <p class="text-muted">This may take a moment as we analyze game tags and similarities.</p>
        <div class="alert alert-info mt-3">
          <i class="fas fa-clock me-2"></i>
          <strong>Please wait up to 30 seconds for recommendations</strong>
          <p class="mb-0 small">We're analyzing thousands of games to find the most similar ones based on your selected game's tags.</p>
        </div>
        <div class="progress mt-3" style="height: 6px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated" 
               role="progressbar" 
               style="width: 100%"
               aria-valuenow="100" 
               aria-valuemin="0" 
               aria-valuemax="100">
          </div>
        </div>
      </div>
    </div>

    <!-- Similar Games Results -->
    <div v-else-if="similarGames.length > 0" class="card">
      <div class="card-header">
        <h5><i class="fas fa-thumbs-up"></i> Similar Games ({{ similarGames.length }})</h5>
      </div>
      <div class="card-body">
        <div class="table-responsive">
                <table class="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Steam Review Score</th>
                      <th>Total Reviews</th>
                      <th>Release Date</th>
                      <th>Similarity Score</th>
                      <th>Common Tags</th>
                      <th>Common Tag List</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="game in similarGames" :key="game.appId">
                      <td>
                        <a
                          :href="`https://store.steampowered.com/app/${game.appId}`"
                          target="_blank"
                          class="game-link"
                        >
                          {{ game.name }}
                        </a>
                        <span v-if="game.isFree" class="badge bg-success ms-2">Free</span>
                      </td>
                      <td>
                        <span v-if="game.reviewScoreDesc && game.reviewScoreDesc !== 'N/A'" 
                              :class="getScoreTextClass(game.reviewScoreDesc)">
                          {{ game.reviewScoreDesc }}
                        </span>
                        <span v-else class="text-muted">N/A</span>
                      </td>
                      <td>
                        <span v-if="game.totalPositive && game.totalNegative">
                          {{ (game.totalPositive + game.totalNegative).toLocaleString() }}
                        </span>
                        <span v-else class="text-muted">N/A</span>
                      </td>
                      <td>
                        <span v-if="game.releaseDate">
                          {{ formatDate(game.releaseDate) }}
                        </span>
                        <span v-else class="text-muted">N/A</span>
                      </td>
                      <td>
                        <div class="similarity-score">
                          <div class="score-bar" 
                               :class="getSimilarityScoreClass(game.similarityScore)"
                               :style="{ width: game.similarityScore + '%' }">
                            {{ game.similarityScore }}%
                          </div>
                        </div>
                      </td>
                      <td>{{ game.commonTags }}</td>
                      <td>
                        <div class="tag-list">
                          <span
                            v-for="tag in game.commonTagList"
                            :key="tag"
                            class="tag-badge"
                          >
                            {{ tag }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
        </div>
      </div>
    </div>

    <!-- No Results Message -->
    <div v-else-if="hasSearched && !isLoading" class="card">
      <div class="card-body text-center text-muted py-4">
        <i class="fas fa-search fa-3x mb-3"></i>
        <h5>No similar games found</h5>
        <p class="mb-3">No games meet the current similarity requirements.</p>
        <div v-if="minCommonTags > 5" class="alert alert-info">
          <i class="fas fa-lightbulb me-2"></i>
          <strong>No results? Try to Loosen the similarity</strong>
          <p class="mb-2">Lower the minimum common tags requirement to find more similar games.</p>
          <button 
            class="btn btn-outline-primary btn-sm" 
            @click="loosenResults"
            :disabled="minCommonTags <= 5"
          >
            <i class="fas fa-expand-arrows-alt me-1"></i>
            Loosen Results ({{ minCommonTags - 2 }} tags)
          </button>
        </div>
        <p v-else class="text-muted">Try selecting a different game or adjust your search criteria.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import cubeService from '../services/cubeService'

export default {
  name: 'Recommender',
  setup() {
    // Reactive data
    const gameSearchQuery = ref('')
    const filteredGames = ref([])
    const showGameDropdown = ref(false)
    const selectedGame = ref(null)
    const similarGames = ref([])
    const isLoading = ref(false)
    const hasSearched = ref(false)
    const allGames = ref([]) // Used for client-side fallback search (lazy loaded)
    const minCommonTags = ref(15) // Minimum common tags requirement
    const isSearching = ref(false) // Loading indicator for game search

    // Debounce timer
    let searchTimeout = null

    // Methods
    const searchGames = async () => {
      if (gameSearchQuery.value.trim().length < 3) {
        filteredGames.value = []
        showGameDropdown.value = false
        isSearching.value = false
        return
      }

      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      // Show loading indicator immediately
      isSearching.value = true

      // Debounce search by 300ms
      searchTimeout = setTimeout(async () => {
        try {
          // 1) Try local warm cache first for instant results
          const warm = await cubeService.filterWarmNames(gameSearchQuery.value, 50)
          if (Array.isArray(warm) && warm.length > 0) {
            filteredGames.value = warm
            showGameDropdown.value = true
          }

          // 2) Prefetch warm names in background (once per day)
          cubeService.prefetchWarmNames(10000).catch(() => {})

          // 3) Server-side search for precise/complete results, cached in-memory
          const results = await cubeService.searchGamesByName(gameSearchQuery.value, 100)
          filteredGames.value = results
          showGameDropdown.value = true
        } catch (error) {
          console.error('Error searching games:', error)
          // Last resort: no-op, as warm cache already attempted
        } finally {
          isSearching.value = false
        }
      }, 300)
    }

    const selectGame = (game) => {
      selectedGame.value = game
      gameSearchQuery.value = game.name
      showGameDropdown.value = false
    }

    const clearSelection = () => {
      selectedGame.value = null
      gameSearchQuery.value = ''
      similarGames.value = []
      hasSearched.value = false
    }

    const findSimilarGames = async () => {
      if (!selectedGame.value) return

      isLoading.value = true
      hasSearched.value = true
      similarGames.value = [] // Clear previous results
      
      try {
        console.log('Starting similarity search for:', selectedGame.value.name, 'with min tags:', minCommonTags.value)
        const results = await cubeService.findSimilarGames(selectedGame.value.appId, minCommonTags.value)
        similarGames.value = results
        console.log('Found', results.length, 'similar games')
      } catch (error) {
        console.error('Error finding similar games:', error)
        similarGames.value = []
      } finally {
        isLoading.value = false
      }
    }

    const tightenResults = () => {
      minCommonTags.value = Math.min(minCommonTags.value + 2, 20) // Max 20 tags
      if (selectedGame.value) {
        findSimilarGames() // Re-run search with new criteria
      }
    }

    const loosenResults = () => {
      minCommonTags.value = Math.max(minCommonTags.value - 2, 5) // Min 5 tags
      if (selectedGame.value) {
        findSimilarGames() // Re-run search with new criteria
      }
    }

    // Helper methods for formatting
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    }

    const getScoreClass = (score) => {
      if (!score || score === 'N/A') return 'na'
      const scoreMap = {
        'Overwhelmingly Positive': 'overwhelmingly-positive',
        'Very Positive': 'very-positive',
        'Mostly Positive': 'mostly-positive',
        'Positive': 'positive',
        'Mixed': 'mixed',
        'Mostly Negative': 'mostly-negative',
        'Negative': 'negative',
        'Very Negative': 'very-negative',
        'Overwhelmingly Negative': 'overwhelmingly-negative'
      }
      return scoreMap[score] || 'na'
    }

    const getScoreTextClass = (score) => {
      if (!score || score === 'N/A') return 'text-muted'
      const scoreMap = {
        'Overwhelmingly Positive': 'text-success fw-bold',
        'Very Positive': 'text-primary fw-bold',
        'Mostly Positive': 'text-info',
        'Positive': 'text-success',
        'Mixed': 'text-warning',
        'Mostly Negative': 'text-warning',
        'Negative': 'text-danger',
        'Very Negative': 'text-danger fw-bold',
        'Overwhelmingly Negative': 'text-danger fw-bold'
      }
      return scoreMap[score] || 'text-muted'
    }

    const getSimilarityScoreClass = (score) => {
      if (score >= 80) return 'similarity-excellent' // Green
      if (score >= 60) return 'similarity-good' // Gold
      if (score >= 40) return 'similarity-fair' // Orange
      return 'similarity-poor' // Red
    }

    // No initial load - search starts after 3 characters

    return {
      gameSearchQuery,
      filteredGames,
      showGameDropdown,
      selectedGame,
      similarGames,
      isLoading,
      hasSearched,
      minCommonTags,
      isSearching,
      searchGames,
      selectGame,
      clearSelection,
      findSimilarGames,
      tightenResults,
      loosenResults,
      formatDate,
      getScoreClass,
      getScoreTextClass,
      getSimilarityScoreClass
    }
  }
}
</script>

<style scoped>
.game-search-container {
  position: relative;
}

.search-loading-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  z-index: 10;
}

.game-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2d2d2d;
  border: 1px solid #4d4d4d;
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
}

.game-option {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #4d4d4d;
  color: #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.game-option:hover {
  background-color: #3d3d3d;
}

.game-option:last-child {
  border-bottom: none;
}

.game-app-id {
  color: #9ca3af;
  font-size: 12px;
}

.selected-game-info {
  margin-top: 15px;
}

.similarity-score {
  width: 100px;
  height: 20px;
  background-color: #3d3d3d;
  border: 1px solid #4d4d4d;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.score-bar {
  height: 100%;
  background-color: var(--steam-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 11px;
  transition: width 0.3s ease;
}

/* Similarity Score Color Classes */
.similarity-excellent {
  background-color: #28a745 !important; /* Green */
}

.similarity-good {
  background-color: #ffc107 !important; /* Gold */
  color: #000 !important; /* Black text for gold background */
}

.similarity-fair {
  background-color: #fd7e14 !important; /* Orange */
}

.similarity-poor {
  background-color: #dc3545 !important; /* Red */
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-badge {
  display: inline-block;
  background-color: transparent;
  color: var(--steam-blue);
  border: 1px solid var(--steam-blue);
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
}

/* Steam Score Bar Styles */
.steam-score-bar {
  width: 100%;
  height: 20px;
  background-color: #1b2838;
  border: 1px solid #2a475e;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.steam-score-fill {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: bold;
  transition: width 0.3s ease;
}

.steam-score-fill.overwhelmingly-positive {
  background-color: #4c6b22;
  color: white;
}

.steam-score-fill.very-positive {
  background-color: #5ba3d4;
  color: white;
}

.steam-score-fill.mostly-positive {
  background-color: #66c0f4;
  color: white;
}

.steam-score-fill.positive {
  background-color: #8fbc8f;
  color: white;
}

.steam-score-fill.mixed {
  background-color: #b8860b;
  color: white;
}

.steam-score-fill.mostly-negative {
  background-color: #cd853f;
  color: white;
}

.steam-score-fill.negative {
  background-color: #cd5c5c;
  color: white;
}

.steam-score-fill.very-negative {
  background-color: #dc143c;
  color: white;
}

.steam-score-fill.overwhelmingly-negative {
  background-color: #8b0000;
  color: white;
}

.steam-score-fill.na {
  background-color: #6c757d;
  color: white !important;
}
</style>
