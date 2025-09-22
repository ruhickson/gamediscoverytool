import { createRouter, createWebHistory } from 'vue-router'
import GameFinder from '../views/GameFinder.vue'
import HowToUse from '../views/HowToUse.vue'
import FAQ from '../views/FAQ.vue'
import About from '../views/About.vue'

const routes = [
  {
    path: '/',
    name: 'GameFinder',
    component: GameFinder
  },
  {
    path: '/how-to-use',
    name: 'HowToUse',
    component: HowToUse
  },
  {
    path: '/faq',
    name: 'FAQ',
    component: FAQ
  },
  {
    path: '/about',
    name: 'About',
    component: About
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
