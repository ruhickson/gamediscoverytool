<template>
  <div id="app" :class="{ 'hc-contrast': isHighContrast }">
    <nav class="navbar navbar-expand-lg">
      <div class="container-fluid">
        <router-link class="navbar-brand" to="/">
          <i class="fas fa-gamepad"></i>
          <span class="d-none d-sm-inline">Game Discovery Tool</span>
          <span class="d-sm-none">Game Discovery</span>
        </router-link>

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

    <div v-if="showMobileMenu" class="d-lg-none mobile-nav">
      <div class="container-fluid">
        <ul class="nav flex-column">
          <li v-for="section in navSections" :key="section.title" class="nav-section">
            <p class="nav-section-title">{{ section.title }}</p>
            <ul class="nav flex-column">
              <li v-for="item in section.items" :key="item.to" class="nav-item">
                <router-link
                  :to="item.to"
                  class="nav-link"
                  :class="{ active: isActive(item) }"
                  @click="closeMobileMenu"
                >
                  <i :class="item.icon"></i>
                  {{ item.label }}
                </router-link>
              </li>
            </ul>
          </li>
          <li class="nav-item nav-about">
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
        </ul>
      </div>
    </div>

    <div class="container-fluid">
      <div class="row">
        <nav class="col-md-3 col-lg-2 d-none d-md-block sidebar collapse">
          <div class="position-sticky pt-3">
            <ul class="nav flex-column">
              <li v-for="section in navSections" :key="section.title" class="nav-section">
                <p class="nav-section-title">{{ section.title }}</p>
                <ul class="nav flex-column">
                  <li v-for="item in section.items" :key="'desk-' + item.to" class="nav-item">
                    <router-link
                      :to="item.to"
                      class="nav-link"
                      :class="{ active: isActive(item) }"
                    >
                      <i :class="item.icon"></i>
                      {{ item.label }}
                    </router-link>
                  </li>
                </ul>
              </li>
              <li class="nav-item nav-about">
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

            <div class="support-section">
              <h6 class="support-title">Game Discovery Tool loves and supports</h6>
              <div class="support-links">
                <a href="https://ardan.ie" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/ardan.png" alt="Ardan" class="support-image">
                </a>
                <a href="https://lookingfor.game" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/lookingfor.png" alt="lookingfor.game" class="support-image">
                </a>
                <a href="https://aftermath.site" target="_blank" rel="noopener noreferrer" class="support-link">
                  <img src="/aftermath.webp" alt="Aftermath" class="support-image">
                </a>
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

            <div class="conrad-container" style="display: none;">
              <ConradMascot />
            </div>
          </div>
        </nav>

        <main
          class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-content"
          :class="{ 'essay-bleed': isEssayPage }"
        >
          <router-view />
        </main>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import ConradMascot from './components/ConradMascot.vue'

export default {
  name: 'App',
  components: {
    ConradMascot
  },
  data() {
    return {
      isHighContrast: false,
      showMobileMenu: false,
      navSections: [
        {
          title: 'Media',
          items: [
            { to: '/blog', label: 'Media', icon: 'fas fa-newspaper', names: ['Blog', 'BlogPost'] }
          ]
        },
        {
          title: 'Game Discovery',
          items: [
            { to: '/find', label: 'Find a Game for Me', icon: 'fas fa-search', names: ['GameFinder'] }
          ]
        },
        {
          title: 'Recommender',
          items: [
            { to: '/recommender', label: 'Recommender', icon: 'fas fa-magic', names: ['Recommender'] },
            { to: '/diiig', label: 'DIIIG', icon: 'fas fa-person-digging', names: ['DigGame'] }
          ]
        },
        {
          title: 'Industry',
          items: [
            { to: '/trends', label: 'Trends', icon: 'fas fa-chart-area', names: ['StateOfSteam'] },
            { to: '/trend-analysis', label: 'Trend Analysis', icon: 'fas fa-chart-line', names: ['TrendAnalysis'] }
          ]
        }
      ]
    }
  },
  provide() {
    return {
      isHighContrast: computed(() => this.isHighContrast)
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
    },
    isActive(item) {
      return item.names.includes(this.$route.name)
    }
  },
  computed: {
    isEssayPage() {
      return this.$route.params.slug === '2026-10-22-four-years-after-vampire-survivors'
    }
  }
}
</script>

<style>
.navbar-brand {
  font-size: 1.125rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100vw - 200px);
}

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
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28212, 175, 55, 0.9%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100%;
}
</style>
