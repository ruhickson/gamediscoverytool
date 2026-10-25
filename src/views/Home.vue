<template>
  <div class="home">
    <h1>Game Discovery Tool</h1>
    <p class="home-lead">Find a game, follow Steam, or read what we're publishing.</p>
    <router-link v-if="feature" class="home-feature" :to="`/blog/${feature.slug}`">
      <img
        v-if="feature.featuredImage"
        class="home-hero"
        :src="feature.featuredImage"
        :alt="feature.title"
      />
      <div class="home-feature-body">
        <p v-if="feature.kicker" class="home-kicker">{{ feature.kicker }}</p>
        <h2>{{ feature.title }}</h2>
        <p>{{ feature.excerpt }}</p>
      </div>
    </router-link>
    <div class="home-grid">
      <router-link
        v-for="item in destinations"
        :key="item.to"
        :to="item.to"
        class="home-button"
      >
        <i :class="item.icon" aria-hidden="true"></i>
        <span class="home-button-title">{{ item.title }}</span>
        <span class="home-button-text">{{ item.text }}</span>
      </router-link>
    </div>
  </div>
</template>

<script>
import { loadBlogSummaries } from '../utils/blogPosts.js'

export default {
  name: 'Home',
  data() {
    return {
      feature: null,
      destinations: [
        {
          to: '/blog',
          icon: 'fas fa-newspaper',
          title: 'Media',
          text: 'Essays and notes on games.'
        },
        {
          to: '/find',
          icon: 'fas fa-search',
          title: 'Game discovery',
          text: 'Search Steam by tags, reviews, and release date.'
        },
        {
          to: '/about',
          icon: 'fas fa-info-circle',
          title: 'About',
          text: 'What this is, and how to get in touch.'
        },
        {
          to: '/trends',
          icon: 'fas fa-chart-area',
          title: 'Trends',
          text: 'State of Steam, month by month.'
        }
      ]
    }
  },
  async mounted() {
    try {
      const posts = await loadBlogSummaries()
      this.feature = posts[0] || null
    } catch (err) {
      console.error('Error loading featured post:', err)
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.25rem 0 2.5rem;
}

.home h1 {
  font-size: clamp(2rem, 4vw, 2.75rem);
  margin-bottom: 0.4rem;
}

.home-lead {
  color: var(--color-text-muted);
  font-size: 1.1rem;
  max-width: 36rem;
  margin-bottom: 1.25rem;
}

.home-feature {
  display: block;
  margin-bottom: 1.5rem;
  background: var(--color-surface);
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.home-feature:hover,
.home-feature:focus-visible {
  border-color: var(--color-accent);
  color: inherit;
  text-decoration: none;
  outline: none;
}

.home-hero {
  display: block;
  width: 100%;
  height: auto;
}

.home-feature-body {
  padding: 1.15rem 1.25rem 1.35rem;
}

.home-kicker {
  margin: 0 0 0.35rem;
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.home-feature h2 {
  font-size: clamp(1.45rem, 3vw, 2rem);
  margin-bottom: 0.55rem;
}

.home-feature-body p:last-child {
  margin: 0;
  color: var(--color-text-muted);
}

.home-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.home-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0.4rem;
  min-height: 168px;
  padding: 1.4rem 1.35rem;
  background: var(--color-surface);
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: var(--radius);
  color: var(--color-text);
  text-decoration: none;
  box-shadow: var(--shadow);
  transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
}

.home-button:hover,
.home-button:focus-visible {
  border-color: var(--color-accent);
  background: var(--color-bg-alt);
  color: var(--color-text);
  transform: translateY(-2px);
  outline: none;
}

.home-button i {
  color: var(--color-accent);
  font-size: 1.35rem;
}

.home-button-title {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.2;
}

.home-button-text {
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

@media (max-width: 640px) {
  .home-grid {
    grid-template-columns: 1fr;
  }

  .home-button {
    min-height: 0;
  }
}
</style>
