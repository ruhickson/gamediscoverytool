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
            <input 
              type="text" 
              class="form-control" 
              id="gameSearch" 
              v-model="gameSearchQuery"
              @input="searchGames"
              placeholder="Type to search for games..."
              :disabled="isLoading"
            >
            <div v-if="showGameDropdown && filteredGames.length > 0" class="game-dropdown">
              <div 
                v-for="game in filteredGames.slice(0, 10)" 
                :key="game.appId"
                class="game-option"
                @click="selectGame(game)"
              >
                {{ game.name }}
                <span class="game-app-id">({{ game.appId }})</span>
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
        </div>
      </div>
    </div>

    <!-- Similar Games Results -->
    <div v-if="similarGames.length > 0" class="card">
      <div class="card-header">
        <h5><i class="fas fa-thumbs-up"></i> Similar Games ({{ similarGames.length }})</h5>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead>
              <tr>
                <th>Game</th>
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
                </td>
                <td>
                  <div class="similarity-score">
                    <div class="score-bar" :style="{ width: game.similarityScore + '%' }">
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
        <p>No similar games found. Try selecting a different game.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
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
    const allGames = ref([])

    // Methods
    const searchGames = async () => {
      if (gameSearchQuery.value.trim().length < 2) {
        filteredGames.value = []
        showGameDropdown.value = false
        return
      }

      try {
        const query = gameSearchQuery.value.toLowerCase()
        const results = allGames.value.filter(game => 
          game.name.toLowerCase().includes(query)
        )
        
        filteredGames.value = results.slice(0, 20) // Limit to 20 results
        showGameDropdown.value = true
      } catch (error) {
        console.error('Error searching games:', error)
      }
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
      
      try {
        const results = await cubeService.findSimilarGames(selectedGame.value.appId)
        similarGames.value = results
        console.log('Found', results.length, 'similar games')
      } catch (error) {
        console.error('Error finding similar games:', error)
        similarGames.value = []
      } finally {
        isLoading.value = false
      }
    }

    const loadAllGames = async () => {
      try {
        isLoading.value = true
        // Get a large sample of games for search
        const games = await cubeService.getAllGames(1000)
        allGames.value = games
        console.log('Loaded', games.length, 'games for search')
      } catch (error) {
        console.error('Error loading games:', error)
        allGames.value = []
      } finally {
        isLoading.value = false
      }
    }

    // Lifecycle
    onMounted(() => {
      loadAllGames()
    })

    return {
      gameSearchQuery,
      filteredGames,
      showGameDropdown,
      selectedGame,
      similarGames,
      isLoading,
      hasSearched,
      searchGames,
      selectGame,
      clearSelection,
      findSimilarGames
    }
  }
}
</script>

<style scoped>
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

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-badge {
  display: inline-block;
  background-color: var(--steam-blue);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
}
</style>
