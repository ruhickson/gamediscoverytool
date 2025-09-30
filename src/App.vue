<template>
  <div id="app" :class="{ 'hc-contrast': isHighContrast }">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand" href="#">
          <i class="fas fa-gamepad me-2"></i>
          Game Discovery Tool
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
            class="btn btn-outline-light btn-sm"
            @click="toggleContrast"
            aria-pressed="isHighContrast.toString()"
            aria-label="Toggle high-contrast accessibility mode"
          >
            {{ isHighContrast ? 'Disable Accessibility' : 'Accessibility' }}
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
            </ul>
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
export default {
  name: 'App',
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
</style>
