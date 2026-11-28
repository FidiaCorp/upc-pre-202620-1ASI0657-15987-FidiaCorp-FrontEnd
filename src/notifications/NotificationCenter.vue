<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { session } from '../account/session.js'
import { notificationFeed as feed } from './feed.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'

function updateVisibility() {
  if (document.visibilityState === 'hidden') feed.stop(false)
  else if (session.token && !session.ending) feed.start()
}
const stopWatch = watch(() => session.token, () => { feed.stop(); updateVisibility() })
onMounted(() => { document.addEventListener('visibilitychange', updateVisibility); updateVisibility() })
onUnmounted(() => { stopWatch(); document.removeEventListener('visibilitychange', updateVisibility); feed.stop() })
</script>

<template>
  <div class="notification-center">
    <RouterLink class="bell-link" :class="{ unread: feed.state.unreadCount > 0 }" to="/notifications" :aria-label="`Notificaciones: ${feed.state.unreadCount} sin leer`"><AppIcon name="bell" :size="20" /><span class="bell-text">Notificaciones</span> <span class="notification-badge">{{ feed.state.unreadCount }}</span></RouterLink>
    <div v-if="feed.state.announcement || feed.state.error" class="notification-toast">
      <p v-if="feed.state.announcement" role="status">{{ feed.state.announcement }} <RouterLink to="/notifications">Ver avisos</RouterLink></p>
      <p v-if="feed.state.error" class="form-error" role="status">No se pudieron actualizar los avisos. <button class="text-button" type="button" @click="feed.refresh">Reintentar avisos</button></p>
    </div>
  </div>
</template>

<style scoped>
.bell-link { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; border: 1px solid var(--cc-border); color: var(--cc-text-2); text-decoration: none; background: #fff; }
.bell-link:hover { background: var(--cc-soft); border-color: var(--cc-soft-border); color: var(--cc-navy); }
.bell-text { font-size: 13px; font-weight: 600; }
.notification-badge { background: #f1f5f9; color: var(--cc-text-2); border: 1px solid var(--cc-border); min-width: 22px; }
.bell-link.unread .notification-badge { background: var(--cc-blue); color: #fff; border-color: var(--cc-blue); }
.notification-toast { position: absolute; top: calc(100% + 10px); right: 0; width: min(320px, 80vw); background: #fff; border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); box-shadow: var(--cc-shadow-lg); padding: 10px 12px; z-index: 50; }
.notification-toast { pointer-events: none; }
.notification-toast a, .notification-toast button { pointer-events: auto; }
.notification-toast p { margin: 0; font-size: 13px; }
.notification-toast .form-error { border: 0; background: none; padding: 0; }
@media (max-width: 640px) { .bell-text { display: none; } }
</style>
