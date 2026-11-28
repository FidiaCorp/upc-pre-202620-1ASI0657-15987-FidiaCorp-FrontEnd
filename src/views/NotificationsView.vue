<script setup>
import { onMounted, ref } from 'vue'
import { notificationFeed as feed } from '../notifications/feed.js'
import { formatDate } from '../offers/format.js'
import MessagingCenter from '../messaging/MessagingCenter.vue'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
const unreadOnly = ref(feed.state.unreadOnly)
onMounted(() => feed.refresh())
async function filter() { await feed.setFilters({ unreadOnly: unreadOnly.value }) }
</script>
<template>
  <section aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">US16 · US17 · Comunicación</p>
        <h1 id="page-title">Notificaciones</h1>
        <p class="page-subtitle">Se actualizan cada 5 segundos mientras la aplicación esté visible y tu sesión siga activa.</p>
      </div>
    </div>
    <section class="content-card notices-card" aria-labelledby="notices-heading">
      <div class="notices-header">
        <h2 id="notices-heading"><AppIcon name="bell" :size="18" /> Avisos de ofertas <span class="pill" :class="feed.state.unreadCount ? '' : 'pill-muted'">{{ feed.state.unreadCount }} sin leer</span></h2>
        <div class="notices-tools">
          <label class="checkbox-label"><input v-model="unreadOnly" type="checkbox" @change="filter" /> Solo sin leer</label>
          <button class="secondary-button" type="button" :disabled="feed.state.loading" @click="feed.refresh"><AppIcon name="refresh" :size="15" />Actualizar notificaciones</button>
        </div>
      </div>
      <p class="demo-notice"><span class="pill demo-label">DEMO</span><span>Los avisos corresponden a propuestas de demostración, no a aprobaciones bancarias.</span></p>
      <p v-if="feed.state.loading" role="status">Cargando notificaciones…</p>
      <p v-if="feed.state.error" class="form-error" role="alert">{{ feed.state.error }}</p>
      <p v-if="!feed.state.loading && !feed.state.error && !feed.state.items.length" class="empty-state" role="status">No hay notificaciones para este filtro.</p>
      <ul class="notification-list"><li v-for="notice in feed.state.items" :key="notice.id" class="notice-item" :class="{ unread: !notice.readAt }"><span class="notice-dot" aria-hidden="true"></span><div class="notice-body"><div class="notice-title"><span class="demo-label">DEMO</span><h3>{{ notice.title }}</h3></div><p class="field-help">{{ formatDate(notice.createdAt) }} · {{ notice.readAt ? 'Leída' : 'Sin leer' }}</p></div><div class="notice-actions"><RouterLink class="primary-button" :to="`/offers/${notice.offerId}`">Consultar oferta</RouterLink><button v-if="!notice.readAt" class="secondary-button" type="button" :disabled="Boolean(feed.state.reading)" @click="feed.read(notice.id)"><AppIcon name="check" :size="15" />{{ feed.state.reading === notice.id ? 'Guardando…' : 'Marcar como leída' }}</button></div></li></ul>
      <nav v-if="feed.state.totalPages > 1" class="property-pagination" aria-label="Paginación de notificaciones"><button class="secondary-button" type="button" :disabled="feed.state.page === 0 || feed.state.loading" @click="feed.setFilters({ page: feed.state.page - 1 })">Anterior</button><span>Página {{ feed.state.page + 1 }} de {{ feed.state.totalPages }}</span><button class="secondary-button" type="button" :disabled="feed.state.page + 1 >= feed.state.totalPages || feed.state.loading" @click="feed.setFilters({ page: feed.state.page + 1 })">Siguiente</button></nav>
    </section>
    <MessagingCenter />
  </section>
</template>

<style scoped>
.notices-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.notices-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
.notices-tools { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.notices-tools .checkbox-label { margin: 0; }
.notification-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.notice-item { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); background: #fff; flex-wrap: wrap; }
.notice-item.unread { border-color: var(--cc-soft-border); background: var(--cc-soft); }
.notice-dot { width: 9px; height: 9px; border-radius: 999px; background: #cbd5e1; flex: none; }
.notice-item.unread .notice-dot { background: var(--cc-blue); }
.notice-body { flex: 1; min-width: 200px; }
.notice-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.notice-title h3 { margin: 0; font-size: 15px; }
.notice-body .field-help { margin: 2px 0 0; }
.notice-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.notice-actions .primary-button, .notice-actions .secondary-button { padding: 7px 12px; font-size: 13px; }
</style>
