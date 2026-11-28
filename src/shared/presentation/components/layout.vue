<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import NotificationCenter from '../../../notifications/NotificationCenter.vue'
import LogoutButton from '../../../account/LogoutButton.vue'
import { logoutState, retryLogout } from '../../../account/logout.js'
import { session } from '../../../account/session.js'
import { getProfile } from '../../../account/api.js'
import { navigation } from '../../../router/navigation'
import { notificationFeed as feed } from '../../../notifications/feed.js'
import AppIcon from './AppIcon.vue'
import BrandLogo from './BrandLogo.vue'

const route = useRoute()
const menuOpen = ref(false)
const isAuthRoute = computed(() => ['login', 'register'].includes(route.name))
const authed = computed(() => Boolean(session.token) && !isAuthRoute.value)
const sectionTitle = computed(() => route.meta.title || 'CrediCasa')
const email = computed(() => session.user?.email || '')
const initials = computed(() => {
  const user = session.user
  const fromName = [user?.firstName, user?.lastName].filter(Boolean).map(part => part.trim()[0]).join('')
  return (fromName || email.value.slice(0, 2) || 'CC').toUpperCase()
})
watch(() => route.fullPath, () => { menuOpen.value = false })
// Tras recargar la página la sesión conserva el token pero no el perfil: se recupera para el saludo y la topbar.
let identityRequest = null
watch(authed, value => {
  if (!value || session.user || identityRequest) return
  const token = session.token
  identityRequest = getProfile()
    .then(profile => { if (session.token === token && !session.user) session.user = profile })
    .catch(() => { /* La topbar sigue mostrando "Sesión activa". */ })
    .finally(() => { identityRequest = null })
}, { immediate: true })
</script>

<template>
  <div class="app-shell" :class="{ 'auth-shell': isAuthRoute, 'has-sidebar': authed }">
    <a class="skip-link" href="#main-content">Saltar al contenido</a>

    <template v-if="authed">
      <aside id="app-sidebar" class="app-sidebar" :class="{ open: menuOpen }" aria-label="Menú lateral">
        <div class="sidebar-brand"><RouterLink class="brand" to="/home" aria-label="CrediCasa, inicio"><BrandLogo /></RouterLink></div>
        <nav class="sidebar-nav" aria-label="Navegación principal">
          <p class="sidebar-section">Menú</p>
          <RouterLink v-for="item in navigation" :key="item.name" class="sidebar-link" :to="item.path">
            <AppIcon :name="item.icon" />
            <span>{{ item.title }}</span>
            <span v-if="item.name === 'notifications' && feed.state.unreadCount" class="sidebar-count" aria-hidden="true">{{ feed.state.unreadCount }}</span>
          </RouterLink>
        </nav>
        <div class="sidebar-footer">
          <p class="sidebar-demo"><AppIcon name="info" :size="14" /> Ofertas y tasas DEMO, con fines referenciales.</p>
        </div>
      </aside>
      <button v-if="menuOpen" class="sidebar-backdrop open" type="button" aria-label="Cerrar menú" @click="menuOpen = false" />
    </template>

    <div :class="authed ? 'app-main-column' : 'public-column'">
      <header v-if="authed" class="app-topbar">
        <button class="menu-toggle" type="button" :aria-expanded="menuOpen" aria-controls="app-sidebar" aria-label="Abrir menú" @click="menuOpen = !menuOpen"><AppIcon name="menu" /></button>
        <p class="topbar-title">{{ sectionTitle }}</p>
        <div class="topbar-actions header-account">
          <NotificationCenter />
          <div class="topbar-user">
            <span class="avatar" aria-hidden="true">{{ initials }}</span>
            <span class="version-label">{{ email || 'Sesión activa' }}</span>
          </div>
          <LogoutButton />
        </div>
      </header>
      <header v-else-if="!isAuthRoute" class="public-header">
        <div class="public-toolbar">
          <RouterLink class="brand" to="/home" aria-label="CrediCasa, inicio"><BrandLogo /></RouterLink>
          <nav class="public-links" aria-label="Acceso">
            <RouterLink class="secondary-button" to="/login">Ingresar</RouterLink>
            <RouterLink class="primary-button" to="/register">Crear cuenta</RouterLink>
          </nav>
        </div>
      </header>

      <main id="main-content" class="main-content" tabindex="-1">
        <div v-if="logoutState.warning" class="logout-warning" role="alert">
          <p>{{ logoutState.warning }}</p>
          <button class="text-button" type="button" :disabled="logoutState.busy" @click="retryLogout">{{ logoutState.busy ? 'Reintentando…' : 'Reintentar invalidación' }}</button>
        </div>
        <p v-else-if="logoutState.notice" class="logout-notice" role="status">{{ logoutState.notice }}</p>
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.sidebar-count { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--cc-blue); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
.sidebar-demo { display: flex; gap: 6px; align-items: flex-start; font-size: 11.5px; line-height: 1.45; margin: 0; color: var(--cc-text-3); }
.sidebar-demo svg { margin-top: 2px; flex: none; }
.public-column { min-height: 100svh; display: flex; flex-direction: column; }
</style>
