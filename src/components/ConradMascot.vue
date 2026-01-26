<template>
  <div class="conrad-mascot" :class="{ 'conrad-animate': isAnimating }">
    <div class="conrad-character">
      <!-- Conrad's head -->
      <div class="conrad-head">
        <div class="conrad-eyes">
          <div class="conrad-eye left-eye"></div>
          <div class="conrad-eye right-eye"></div>
        </div>
        <div class="conrad-mouth"></div>
      </div>
      
      <!-- Conrad's body -->
      <div class="conrad-body">
        <div class="conrad-arms">
          <div class="conrad-arm left-arm"></div>
          <div class="conrad-arm right-arm"></div>
        </div>
      </div>
      
      <!-- Conrad's legs -->
      <div class="conrad-legs">
        <div class="conrad-leg left-leg"></div>
        <div class="conrad-leg right-leg"></div>
      </div>
      
      <!-- Detective badge -->
      <div class="conrad-badge">
        <span class="badge-text">GDT</span>
      </div>
    </div>
    
    <!-- Speech bubble -->
    <div class="speech-bubble" v-if="showSpeech">
      <div class="speech-text">
        <span v-if="getCurrentGame()">
          Check out "<a :href="`https://store.steampowered.com/app/${getCurrentGame()['Games.appId']}`" target="_blank" class="game-link">{{ getCurrentGame()['Games.name'] }}</a>" - it's trending!
        </span>
        <span v-else>{{ currentMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import cubeService from '../services/cubeService'

export default {
  name: 'ConradMascot',
  setup() {
    const isAnimating = ref(false)
    const showSpeech = ref(false)
    const currentMessage = ref('')
    const recentGames = ref([])
    let animationInterval = null
    let messageInterval = null

    const baseMessages = [
      'Find your perfect game!',
      'Discover new adventures!',
      'Search by tags & reviews!',
      'Similar games await!',
      'Game on! 🎮',
      'Proudly supports no_clip!',
      'Supports This Week in Video Games!',
      'Built for the gaming community!',
      "I'm not an AI - I'm just a really well fleshed-out sidebar element, duh!"
    ]

    const loadRecentGames = async () => {
      try {
        // Exclude adult games from Conrad's suggestions by default
        const games = await cubeService.getRecentTopGames(20, false)
        recentGames.value = games || []
      } catch (error) {
        console.log('Failed to load recent games for Conrad:', error)
        recentGames.value = []
      }
    }

    const getAllMessages = () => {
      const gameMessages = recentGames.value.map(game => 
        `Check out "${game['Games.name']}" - it's trending!`
      )
      return [...baseMessages, ...gameMessages]
    }

    const getCurrentGame = () => {
      const allMessages = getAllMessages()
      const currentIndex = allMessages.indexOf(currentMessage.value)
      if (currentIndex >= baseMessages.length) {
        const gameIndex = currentIndex - baseMessages.length
        return recentGames.value[gameIndex]
      }
      return null
    }

    const startAnimation = () => {
      animationInterval = setInterval(() => {
        isAnimating.value = true
        setTimeout(() => {
          isAnimating.value = false
        }, 2000)
      }, 8000)
    }

    const showRandomMessage = () => {
      messageInterval = setInterval(() => {
        const allMessages = getAllMessages()
        const randomMessage = allMessages[Math.floor(Math.random() * allMessages.length)]
        currentMessage.value = randomMessage
        showSpeech.value = true
        
        setTimeout(() => {
          showSpeech.value = false
        }, 5000) // Show for 5 seconds
      }, 7000) // Show every 7 seconds (2 second gap between messages)
    }

    onMounted(async () => {
      // Load recent games first
      await loadRecentGames()
      
      // Start animations after a short delay
      setTimeout(() => {
        startAnimation()
        showRandomMessage()
      }, 2000)
    })

    onUnmounted(() => {
      if (animationInterval) clearInterval(animationInterval)
      if (messageInterval) clearInterval(messageInterval)
    })

    return {
      isAnimating,
      showSpeech,
      currentMessage,
      getCurrentGame
    }
  }
}
</script>

<style scoped>
.conrad-mascot {
  position: relative;
  width: 80px;
  height: 120px;
  margin: 20px auto;
  transform-origin: center bottom;
  transition: all 0.3s ease;
  overflow: visible;
}

.conrad-mascot:hover {
  transform: scale(1.1);
}

.conrad-character {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Conrad's head */
.conrad-head {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 100%);
  border: 2px solid #2a2a2a;
  border-radius: 50%;
  margin: 0 auto 8px;
  position: relative;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
}

.conrad-eyes {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 8px;
}

.conrad-eye {
  width: 6px;
  height: 6px;
  background: #00ffff;
  border: 1px solid #0088aa;
  border-radius: 50%;
  position: absolute;
  top: 0;
  box-shadow: 0 0 5px #00ffff;
}

.left-eye {
  left: 2px;
}

.right-eye {
  right: 2px;
}

.conrad-mouth {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 2px;
  background: #2a2a2a;
  border-radius: 1px;
}

/* Conrad's body */
.conrad-body {
  width: 24px;
  height: 32px;
  background: linear-gradient(135deg, #3a3a3a 0%, #5a5a5a 100%);
  border: 2px solid #2a2a2a;
  margin: 0 auto 8px;
  position: relative;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.2);
}

.conrad-arms {
  position: absolute;
  top: 4px;
  width: 100%;
  height: 20px;
}

.conrad-arm {
  width: 8px;
  height: 16px;
  background: linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 100%);
  border: 1px solid #2a2a2a;
  position: absolute;
  top: 0;
}

.left-arm {
  left: -6px;
  transform-origin: top right;
}

.right-arm {
  right: -6px;
  transform-origin: top left;
}

/* Conrad's legs */
.conrad-legs {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
}

.conrad-leg {
  width: 10px;
  height: 20px;
  background: linear-gradient(135deg, #3a3a3a 0%, #5a5a5a 100%);
  border: 1px solid #2a2a2a;
  position: absolute;
  bottom: 0;
}

.left-leg {
  left: 2px;
  transform-origin: top center;
}

.right-leg {
  right: 2px;
  transform-origin: top center;
}

/* Detective badge */
.conrad-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #ff6b00 0%, #ff8c00 100%);
  border: 2px solid #cc5500;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px rgba(255, 107, 0, 0.5);
}

.badge-text {
  font-size: 6px;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
}

/* Animations */
.conrad-animate .conrad-head {
  animation: conrad-blink 0.3s ease;
}

.conrad-animate .left-arm {
  animation: conrad-wave-left 2s ease-in-out;
}

.conrad-animate .right-arm {
  animation: conrad-wave-right 2s ease-in-out;
}

.conrad-animate .left-leg {
  animation: conrad-step-left 2s ease-in-out;
}

.conrad-animate .right-leg {
  animation: conrad-step-right 2s ease-in-out;
}

@keyframes conrad-blink {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.1); }
}

@keyframes conrad-wave-left {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-20deg); }
  50% { transform: rotate(-10deg); }
  75% { transform: rotate(-15deg); }
}

@keyframes conrad-wave-right {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(20deg); }
  50% { transform: rotate(10deg); }
  75% { transform: rotate(15deg); }
}

@keyframes conrad-step-left {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

@keyframes conrad-step-right {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(5deg); }
  75% { transform: rotate(-5deg); }
}

/* Speech bubble */
.speech-bubble {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #00ffff;
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 10px;
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.4);
  animation: bubble-appear 0.3s ease;
  max-width: 150px;
  width: max-content;
  z-index: 1000;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

.speech-bubble::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: #00ffff;
}

.speech-text {
  font-size: 12px;
  color: #00ffff;
  text-align: center;
  text-shadow: 0 0 5px #00ffff;
  font-weight: bold;
  line-height: 1.2;
  max-width: 100%;
}

.speech-text .game-link {
  color: #ffff00;
  text-decoration: underline;
  text-shadow: 0 0 5px #ffff00;
  font-weight: bold;
  transition: all 0.3s ease;
}

.speech-text .game-link:hover {
  color: #ffffff;
  text-shadow: 0 0 8px #ffffff;
  transform: scale(1.05);
}

@keyframes bubble-appear {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(10px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .conrad-mascot {
    width: 60px;
    height: 90px;
    margin: 15px auto;
  }
  
  .speech-bubble {
    display: none; /* Hide speech on mobile */
  }
}

/* Ensure speech bubble stays within sidebar bounds */
@media (min-width: 768px) {
  .conrad-mascot {
    position: relative;
    overflow: visible;
  }
  
  .speech-bubble {
    /* Ensure bubble doesn't extend beyond sidebar */
    left: 50%;
    transform: translateX(-50%);
    max-width: 140px;
    right: auto;
  }
  
  /* Adjust positioning for very narrow sidebars */
  @media (max-width: 991px) {
    .speech-bubble {
      max-width: 120px;
      font-size: 9px;
    }
  }
  
  /* Extra narrow sidebars */
  @media (max-width: 768px) {
    .speech-bubble {
      max-width: 100px;
      font-size: 8px;
      padding: 6px 8px;
    }
  }
}
</style>
