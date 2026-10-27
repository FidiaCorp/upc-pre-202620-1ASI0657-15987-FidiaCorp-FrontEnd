import { createRouter, createWebHistory } from 'vue-router'
import SectionView from '../views/SectionView.vue'
import Home from '../shared/presentation/views/home.vue'
import NotFoundView from '../views/NotFoundView.vue'
import AuthView from '../views/AuthView.vue'
import ProfileView from '../views/ProfileView.vue'
import PropertiesView from '../views/PropertiesView.vue'
import { isAuthenticated } from '../account/session.js'
import { safeRedirect } from '../account/validation.js'
import { navigation } from './navigation'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/login', name: 'login', component: AuthView, meta: { title: 'Ingresar', guestOnly: true } },
    { path: '/register', name: 'register', component: AuthView, meta: { title: 'Crear cuenta', guestOnly: true } },
    ...navigation.map(({ path, name, title, description }) => ({
      path,
      name,
      component: name === 'home' ? Home : name === 'profile' ? ProfileView : name === 'real-estate' ? PropertiesView : SectionView,
      props: ['home', 'profile', 'real-estate'].includes(name) ? false : { title, description },
      meta: { title, requiresAuth: name !== 'home' },
    })),
    { path: '/:pathMatch(.*)*', component: NotFoundView, meta: { title: 'Página no encontrada' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const authenticated = isAuthenticated()
  if (to.meta.requiresAuth && !authenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && authenticated) return safeRedirect(to.query.redirect)
})

router.afterEach((to) => {
  document.title = `${to.meta.title} | FidiaCorp`
})

export default router
