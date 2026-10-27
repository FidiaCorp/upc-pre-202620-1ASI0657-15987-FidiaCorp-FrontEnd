<script setup>
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
          <span v-if="session.token" class="version-label">{{ session.user?.email || 'Sesión activa' }}</span>
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
      <RouterView />
    </main>
  </div>
</template>
