import { createRouter, createWebHistory } from 'vue-router'
import StateOfSteam from '../views/StateOfSteam.vue'
import GameFinder from '../views/GameFinder.vue'
import Recommender from '../views/Recommender.vue'
import HowToUse from '../views/HowToUse.vue'
import About from '../views/About.vue'
import Blog from '../views/Blog.vue'
import BlogPost from '../views/BlogPost.vue'
import Newsletter from '../views/Newsletter.vue'

const routes = [
  {
    path: '/',
    name: 'StateOfSteam',
    component: StateOfSteam
  },
  {
    path: '/find',
    name: 'GameFinder',
    component: GameFinder
  },
  {
    path: '/recommender',
    name: 'Recommender',
    component: Recommender
  },
  {
    path: '/how-to-use',
    name: 'HowToUse',
    component: HowToUse
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  {
    path: '/blog',
    name: 'Blog',
    component: Blog
  },
  {
    path: '/blog/:slug',
    name: 'BlogPost',
    component: BlogPost
  },
  {
    path: '/newsletter',
    name: 'Newsletter',
    component: Newsletter
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Preserve old shared Game Finder links that used query params on /
router.beforeEach((to) => {
  if (to.name !== 'StateOfSteam') return true
  const q = to.query || {}
  const looksLikeFinderShare = [
    'tags', 'exclude', 'reviewScore', 'minReviews', 'maxReviews',
    'minDate', 'maxDate', 'orderBy', 'quickDateRange', 'dateMode'
  ].some((key) => q[key] != null && q[key] !== '')
  if (looksLikeFinderShare) {
    return { path: '/find', query: q, hash: to.hash }
  }
  return true
})

export default router
