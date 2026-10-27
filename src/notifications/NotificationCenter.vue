<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { session } from '../account/session.js'
import { notificationFeed as feed } from './feed.js'

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
    <RouterLink to="/notifications" :aria-label="`Notificaciones: ${feed.state.unreadCount} sin leer`">Notificaciones <span class="notification-badge">{{ feed.state.unreadCount }}</span></RouterLink>
    <p v-if="feed.state.announcement" role="status">{{ feed.state.announcement }} <RouterLink to="/notifications">Ver avisos</RouterLink></p>
    <p v-if="feed.state.error" class="form-error" role="status">No se pudieron actualizar los avisos. <button class="text-button" type="button" @click="feed.refresh">Reintentar avisos</button></p>
  </div>
</template>
