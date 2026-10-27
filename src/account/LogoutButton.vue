<script setup>
import { useRouter } from 'vue-router'
import { logout, logoutState } from './logout.js'
import { session } from './session.js'

const router = useRouter()
async function close() {
  if (logoutState.busy || !session.token) return
  const completion = logout()
  await router.replace({ name: 'login', query: { loggedOut: '1' } })
  await completion
}
</script>

<template>
  <button v-if="session.token" type="button" class="text-button logout-button" :disabled="logoutState.busy" @click="close">Cerrar sesión</button>
</template>
