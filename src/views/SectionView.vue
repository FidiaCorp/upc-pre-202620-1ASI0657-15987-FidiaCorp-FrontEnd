<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  isHome: { type: Boolean, default: false },
})
</script>

<template>
  <section class="content-card" aria-labelledby="page-title">
    <p class="eyebrow">{{ isHome ? 'FidiaCorp' : 'En preparación' }}</p>
    <h1 id="page-title">{{ title }}</h1>
    <p>{{ description }}</p>
    <p v-if="isHome" class="setup-note">
      Explora las secciones que estarán disponibles en las próximas entregas.
    </p>
    <RouterLink v-else class="text-link" to="/home">Volver al inicio</RouterLink>
  </section>
</template>
