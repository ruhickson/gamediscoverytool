<template>
  <div id="app" :class="{ 'hc-contrast': isHighContrast }">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand" href="https://gamediscoverytool.com">
          <i class="fas fa-gamepad me-2"></i>
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
    <div v-if="showMobileMenu" class="d-lg-none mobile-nav bg-dark">
      <div class="container-fluid">
        <ul class="nav flex-column">
          <li class="nav-item">
            <router-link 
              to="/" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'GameFinder' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-search me-2"></i>
              Find a Game for Me
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/recommender" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'Recommender' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-magic me-2"></i>
              Recommender
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/blog" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'Blog' || $route.name === 'BlogPost' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-blog me-2"></i>
              Blog
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/how-to-use" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'HowToUse' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-question-circle me-2"></i>
              How to Use
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/about" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'About' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-info-circle me-2"></i>
              About
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/faq" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'FAQ' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-comments me-2"></i>
              FAQ
            </router-link>
          </li>
          <li class="nav-item">
            <router-link 
              to="/report" 
              class="nav-link text-light"
              :class="{ active: $route.name === 'ReportIssue' }"
              @click="closeMobileMenu"
            >
              <i class="fas fa-flag me-2"></i>
              Report an Issue
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
                  to="/blog" 
                  class="nav-link"
                  :class="{ active: $route.name === 'Blog' || $route.name === 'BlogPost' }"
                >
                  <i class="fas fa-blog"></i>
                  Blog
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
                  to="/faq" 
                  class="nav-link"
                  :class="{ active: $route.name === 'FAQ' }"
                >
                  <i class="fas fa-question"></i>
                  F.A.Q.
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
                  to="/report" 
                  class="nav-link"
                  :class="{ active: $route.name === 'ReportIssue' }"
                >
                  <i class="fas fa-flag"></i>
                  Report an Issue
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
            
            <!-- Conrad Mascot Container -->
            <div class="conrad-container">
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
  font-size: 1.25rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100vw - 200px); /* Leave space for toggle button and accessibility button */
}

/* Mobile-specific navbar brand adjustments */
@media (max-width: 991.98px) {
  .navbar-brand {
    font-size: 1rem;
    max-width: calc(100vw - 120px); /* More space for mobile toggle */
  }
}

@media (max-width: 576px) {
  .navbar-brand {
    font-size: 0.9rem;
    max-width: calc(100vw - 100px);
  }
  
  .navbar-brand i {
    font-size: 0.8rem;
  }
  
  .accessibility-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
}

/* Extra small screens - make title even more compact */
@media (max-width: 400px) {
  .navbar-brand {
    font-size: 0.8rem;
    max-width: calc(100vw - 80px);
  }
  
  .navbar-brand i {
    font-size: 0.7rem;
  }
  
  .accessibility-btn {
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
  }
}

/* Mobile Navigation */
.mobile-nav {
  border-top: 1px solid #495057;
  padding: 1rem 0;
}

.mobile-nav .nav-link {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #495057;
}

.mobile-nav .nav-link:hover {
  background-color: #495057;
}

.mobile-nav .nav-link.active {
  background-color: #0d6efd;
  color: white !important;
}

/* Ensure mobile menu is visible on small screens */
@media (max-width: 991.98px) {
  .mobile-nav {
    display: block !important;
  }
}

/* Conrad container to contain speech bubbles */
.conrad-container {
  position: relative;
  overflow: visible;
  margin-top: 20px;
  padding-bottom: 80px; /* Space for speech bubble */
}

/* Sidebar Support Section */
.support-section {
  margin-top: 2rem;
  padding: 1rem 0;
  border-top: 1px solid var(--pixel-border);
}

.support-title {
  color: var(--pixel-text);
  font-size: 10px;
  font-weight: 500;
  text-align: center;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.support-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.support-link {
  cursor: pointer;
  transition: all 0.3s ease;
}

.support-link:hover {
  transform: scale(1.05);
}

.support-image {
  max-width: 120px;
  height: auto;
  border: 1px solid var(--pixel-border);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.support-image:hover {
  border-color: var(--pixel-cyan);
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}
</style>
