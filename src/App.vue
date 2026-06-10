<template>
  <div id="app" :class="{ 'hc-contrast': isHighContrast }">
    <nav class="navbar navbar-expand-lg">
      <div class="container-fluid">
        <a class="navbar-brand" href="https://gamediscoverytool.com">
          <i class="fas fa-gamepad"></i>
          <span class="d-none d-sm-inline">Game Discovery Tool</span>
          <span class="d-sm-none">Game Discovery</span>
        </a>
        
        <!-- Mobile menu toggle button -->
        <button 
          class="navbar-toggler d-lg-none" 
          type="button" 
          @click="toggleMobileMenu"
          aria-controls="mobileNavbar"
          aria-expanded="showMobileMenu"
          aria-label="Toggle navigation"
          style="border: 1px solid var(--color-border); border-radius: var(--radius); padding: 0.25rem 0.5rem;"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        
        <div class="d-flex ms-auto">
          <button
            class="btn btn-outline-light btn-sm accessibility-btn"
            @click="toggleContrast"
            aria-pressed="isHighContrast.toString()"
            aria-label="Toggle high-contrast accessibility mode"
          >
            <span class="d-none d-md-inline">{{ isHighContrast ? 'Disable Accessibility' : 'Accessibility' }}</span>
            <span class="d-md-none">{{ isHighContrast ? 'Disable' : 'A11y' }}</span>
          </button>
        </div>
      </div>
    </nav>
    
    <!-- Mobile Navigation Menu -->
    <div v-if="showMobileMenu" class="d-lg-none mobile-nav">
      <div class="container-fluid">
        <ul class="nav flex-column">
          <li class="nav-item">
            <router-link 
              to="/" 
              class="nav-link"
              :class="{ active: $route.name === 'GameFinder' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-search"></i>
              Find a Game for Me
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/recommender" 
              class="nav-link"
              :class="{ active: $route.name === 'Recommender' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-magic"></i>
              Recommender
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/how-to-use" 
              class="nav-link"
              :class="{ active: $route.name === 'HowToUse' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-question-circle"></i>
              How to Use
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/about" 
              class="nav-link"
              :class="{ active: $route.name === 'About' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-info-circle"></i>
              About
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/newsletter" 
              class="nav-link"
              :class="{ active: $route.name === 'Newsletter' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-envelope"></i>
              Newsletter
            </router-link>
          </li>
        </ul>
      </div>
    </div>
    
    <div class="container-fluid">
      <div class="row">
        <!-- Desktop Sidebar -->
        <nav class="col-md-3 col-lg-2 d-none d-md-block sidebar collapse">
          <div class="position-sticky pt-3">
            <ul class="nav flex-column">
              <li class="nav-item">
                <router-link 
                  to="/" 
                  class="nav-link"
                  :class="{ active: $route.name === 'GameFinder' }"
                >
                  <i class="fas fa-search"></i>
                  Find a Game for Me
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/recommender" 
                  class="nav-link"
                  :class="{ active: $route.name === 'Recommender' }"
                >
                  <i class="fas fa-magic"></i>
                  Recommender
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/how-to-use" 
                  class="nav-link"
                  :class="{ active: $route.name === 'HowToUse' }"
                >
                  <i class="fas fa-question-circle"></i>
                  How to Use
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/about" 
                  class="nav-link"
                  :class="{ active: $route.name === 'About' }"
                >
                  <i class="fas fa-info-circle"></i>
                  About
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/newsletter" 
                  class="nav-link"
                  :class="{ active: $route.name === 'Newsletter' }"
                >
                  <i class="fas fa-envelope"></i>
                  Newsletter
                </router-link>
              </li>
            </ul>
            
            <!-- Support Section -->
            <div class="support-section">
              <h6 class="support-title">Game Discovery Tool loves and supports</h6>
              <div class="support-links">
                <a href="https://www.imirt.ie/" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/imirt.jpg" alt="Imirt" class="support-image">
                </a>
                <a href="https://www.twitch.tv/oatsngoats" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/oatsngoats.jpeg" alt="Oats n Goats" class="support-image">
                </a>
                <a href="https://thisweekinvideogames.com" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/twiv.jpg" alt="TWIV" class="support-image">
                </a>
                <a href="https://www.patreon.com/cw/noclip" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/noclip.jpg" alt="Noclip" class="support-image">
                </a>
              </div>
            </div>
            
            <!-- Conrad Mascot Container - Hidden in minimalist design -->
            <div class="conrad-container" style="display: none;">
              <ConradMascot />
            </div>
          </div>
        </nav>

        <!-- Main content -->
        <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-content">
          <router-view />
        </main>
      </div>
    </div>
  </div>
</template>

<script>
import ConradMascot from './components/ConradMascot.vue'

export default {
  name: 'App',
  components: {
    ConradMascot
  },
  data() {
    return {
      isHighContrast: false,
      showMobileMenu: false
    }
  },
  methods: {
    toggleContrast() {
      this.isHighContrast = !this.isHighContrast
    },
    toggleMobileMenu() {
      this.showMobileMenu = !this.showMobileMenu
    },
    closeMobileMenu() {
      this.showMobileMenu = false
    }
  }
}
</script>

<style>
/* Responsive Navbar Brand */
.navbar-brand {
  font-size: 1.125rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100vw - 200px);
}

/* Mobile-specific navbar brand adjustments */
@media (max-width: 991.98px) {
  .navbar-brand {
    font-size: 1rem;
    max-width: calc(100vw - 120px);
  }
}

@media (max-width: 576px) {
  .navbar-brand {
    font-size: 0.9rem;
    max-width: calc(100vw - 100px);
  }
  
  .navbar-brand i {
    font-size: 0.9rem;
  }
  
  .accessibility-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
}

/* Extra small screens */
@media (max-width: 400px) {
  .navbar-brand {
    font-size: 0.85rem;
    max-width: calc(100vw - 80px);
  }
  
  .navbar-brand i {
    font-size: 0.85rem;
  }
  
  .accessibility-btn {
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
  }
}

/* Ensure mobile menu is visible on small screens */
@media (max-width: 991.98px) {
  .mobile-nav {
    display: block !important;
  }
}

.navbar-toggler-icon {
  display: inline-block;
  width: 1.5em;
  height: 1.5em;
  vertical-align: middle;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%2833, 37, 41, 0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100%;
}
</style>
