<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  isHome: { type: Boolean, default: false },
})
</script>

<template>
  <section class="content-card" aria-labelledby="page-title">
    <p class="eyebrow">CrediCasa</p>
    <h1 id="page-title">{{ title }}</h1>
    <p class="page-subtitle">{{ description }}</p>
    <RouterLink v-if="!isHome" class="text-link" to="/home">Volver al inicio</RouterLink>
  </section>
</template>
