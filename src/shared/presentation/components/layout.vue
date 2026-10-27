<script setup>
import NotificationCenter from '../../../notifications/NotificationCenter.vue'
import LogoutButton from '../../../account/LogoutButton.vue'
import { logoutState, retryLogout } from '../../../account/logout.js'
import { session } from '../../../account/session.js'
import { navigation } from '../../../router/navigation'
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Saltar al contenido</a>
    <header class="site-header">
      <pv-toolbar class="site-toolbar" aria-label="Cabecera de FidiaCorp">
        <template #start>
          <RouterLink class="brand" to="/home" aria-label="FidiaCorp, inicio">FidiaCorp</RouterLink>
        </template>
        <template #end>
          <div v-if="session.token" class="header-account"><span class="version-label">{{ session.user?.email || 'Sesión activa' }}</span><NotificationCenter /><LogoutButton /></div>
          <RouterLink v-else class="text-link" to="/login">Ingresar</RouterLink>
        </template>
      </pv-toolbar>
      <nav class="site-navigation" aria-label="Navegación principal">
        <RouterLink v-for="item in navigation.filter(item => item.name === 'home' || session.token)" :key="item.name" :to="item.path">
          {{ item.title }}
        </RouterLink>
      <RouterLink v-if="!session.token" to="/register">Crear cuenta</RouterLink>
      </nav>
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
</template>
