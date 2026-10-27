<script setup>
import { onMounted, ref } from 'vue'
import { notificationFeed as feed } from '../notifications/feed.js'
import { formatDate } from '../offers/format.js'
const unreadOnly = ref(feed.state.unreadOnly)
onMounted(() => feed.refresh())
async function filter() { await feed.setFilters({ unreadOnly: unreadOnly.value }) }
</script>
<template>
  <section aria-labelledby="page-title">
    <h1 id="page-title">Notificaciones</h1>
    <p>Se actualizan cada 5 segundos mientras la aplicación esté visible y tu sesión siga activa.</p>
    <p class="demo-notice">DEMO: los avisos corresponden a propuestas de demostración, no a aprobaciones bancarias.</p>
    <label class="checkbox-label"><input v-model="unreadOnly" type="checkbox" @change="filter" /> Solo sin leer</label>
    <p v-if="feed.state.loading" role="status">Cargando notificaciones…</p>
    <p v-if="feed.state.error" class="form-error" role="alert">{{ feed.state.error }}</p>
    <button class="text-button" type="button" :disabled="feed.state.loading" @click="feed.refresh">Actualizar notificaciones</button>
    <p v-if="!feed.state.loading && !feed.state.error && !feed.state.items.length" role="status">No hay notificaciones para este filtro.</p>
    <ul class="notification-list"><li v-for="notice in feed.state.items" :key="notice.id" class="content-card"><span class="demo-label">DEMO</span><h2>{{ notice.title }}</h2><p>{{ formatDate(notice.createdAt) }} · {{ notice.readAt ? 'Leída' : 'Sin leer' }}</p><RouterLink class="text-link" :to="`/offers/${notice.offerId}`">Consultar oferta</RouterLink><button v-if="!notice.readAt" class="text-button" type="button" :disabled="Boolean(feed.state.reading)" @click="feed.read(notice.id)">{{ feed.state.reading === notice.id ? 'Guardando…' : 'Marcar como leída' }}</button></li></ul>
    <nav v-if="feed.state.totalPages > 1" class="property-pagination" aria-label="Paginación de notificaciones"><button class="primary-button" type="button" :disabled="feed.state.page === 0 || feed.state.loading" @click="feed.setFilters({ page: feed.state.page - 1 })">Anterior</button><span>Página {{ feed.state.page + 1 }} de {{ feed.state.totalPages }}</span><button class="primary-button" type="button" :disabled="feed.state.page + 1 >= feed.state.totalPages || feed.state.loading" @click="feed.setFilters({ page: feed.state.page + 1 })">Siguiente</button></nav>
  </section>
</template>
