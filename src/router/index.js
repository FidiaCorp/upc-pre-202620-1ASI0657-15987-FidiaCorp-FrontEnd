import { createRouter, createWebHistory } from 'vue-router'
import SectionView from '../views/SectionView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { navigation } from './navigation'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/home' },
    ...navigation.map(({ path, name, title, description }) => ({
      path,
      name,
      component: SectionView,
      props: { title, description, isHome: name === 'home' },
      meta: { title },
    })),
    { path: '/:pathMatch(.*)*', component: NotFoundView, meta: { title: 'Página no encontrada' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = `${to.meta.title} | FidiaCorp`
})

export default router
