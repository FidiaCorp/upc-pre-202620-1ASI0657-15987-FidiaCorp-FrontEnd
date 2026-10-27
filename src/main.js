import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Toolbar from 'primevue/toolbar'
import App from './App.vue'
import router from './router/index.js'
import './style.css'

createApp(App)
  .use(router)
  .use(PrimeVue, { unstyled: true })
  .component('pv-toolbar', Toolbar)
  .mount('#app')
