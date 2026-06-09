import { createRouter, createWebHistory } from 'vue-router'
import GameFinder from '../views/GameFinder.vue'
import Recommender from '../views/Recommender.vue'
import HowToUse from '../views/HowToUse.vue'
import FAQ from '../views/FAQ.vue'
import About from '../views/About.vue'
import Blog from '../views/Blog.vue'
import BlogPost from '../views/BlogPost.vue'
import ReportIssue from '../views/ReportIssue.vue'
import Newsletter from '../views/Newsletter.vue'

const routes = [
  {
    path: '/',
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
    path: '/faq',
    name: 'FAQ',
    component: FAQ
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
    path: '/report',
    name: 'ReportIssue',
    component: ReportIssue
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

export default router
