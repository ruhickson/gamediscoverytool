import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { installAnalytics } from './services/analytics'
import './style.css'

installAnalytics(router)

const app = createApp(App)
app.use(router)
app.mount('#app')
