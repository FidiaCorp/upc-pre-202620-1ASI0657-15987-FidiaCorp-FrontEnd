<script setup>
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
          <span class="version-label">Versión inicial</span>
        </template>
      </pv-toolbar>
      <nav class="site-navigation" aria-label="Navegación principal">
        <RouterLink v-for="item in navigation" :key="item.name" :to="item.path">
          {{ item.title }}
        </RouterLink>
      </nav>
    </header>
    <main id="main-content" class="main-content" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>
