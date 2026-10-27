import { createApp, watch } from 'vue'
import PrimeVue from 'primevue/config'
import Toolbar from 'primevue/toolbar'
import App from './App.vue'
import router from './router/index.js'
import './style.css'
import { session } from './account/session.js'

watch(() => session.token, (token) => {
  if (!token && router.currentRoute.value.meta.requiresAuth) {
    router.replace({ name: 'login', query: { expired: '1', redirect: router.currentRoute.value.fullPath } })
  }
})

createApp(App)
  .use(router)
  .use(PrimeVue, { unstyled: true })
  .component('pv-toolbar', Toolbar)
  .mount('#app')
