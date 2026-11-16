<script setup>
import { onMounted, reactive, ref } from 'vue'
import {
  blockUser,
  exportConversationJson,
  exportConversationText,
  listBlockedUsers,
  sendMessage,
  unblockUser,
} from './api.js'

const activeTab = ref('chat') // 'chat' | 'blocks'
const conversationId = ref('conv-general-001')
const recipientId = ref('')
const messageText = ref('')
const sending = ref(false)
const exporting = ref(false)
const actionError = ref('')
const actionSuccess = ref('')

const blockedUsers = ref([])
const loadingBlocked = ref(false)
const blockTargetId = ref('')
const blockReason = ref('')
const blocking = ref(false)

async function loadBlocked() {
  loadingBlocked.value = true
  actionError.value = ''
  try {
    const list = await listBlockedUsers()
    blockedUsers.value = Array.isArray(list) ? list : []
  } catch (err) {
    actionError.value = err.message || 'No se pudo cargar la lista de bloqueados.'
  } finally {
    loadingBlocked.value = false
  }
}

async function handleSendMessage() {
  if (!recipientId.value.trim() || !messageText.value.trim()) {
    actionError.value = 'Completa el destinatario y el texto del mensaje.'
    return
  }
  sending.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await sendMessage({
      recipientId: recipientId.value.trim(),
      content: messageText.value.trim(),
    })
    actionSuccess.value = 'Mensaje enviado correctamente.'
    messageText.value = ''
  } catch (err) {
    actionError.value = err.message || 'No se pudo enviar el mensaje.'
  } finally {
    sending.value = false
  }
}

async function handleExportText() {
  if (!conversationId.value.trim()) return
  exporting.value = true
  actionError.value = ''
  try {
    await exportConversationText(conversationId.value.trim())
  } catch (err) {
    actionError.value = err.message || 'Error al exportar la conversación en texto.'
  } finally {
    exporting.value = false
  }
}

async function handleExportJson() {
  if (!conversationId.value.trim()) return
  exporting.value = true
  actionError.value = ''
  try {
    await exportConversationJson(conversationId.value.trim())
  } catch (err) {
    actionError.value = err.message || 'Error al exportar la conversación en JSON.'
  } finally {
    exporting.value = false
  }
}

async function handleBlockUser() {
  if (!blockTargetId.value.trim()) {
    actionError.value = 'Ingresa el ID del usuario a bloquear.'
    return
  }
  blocking.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await blockUser(blockTargetId.value.trim(), blockReason.value.trim() || 'Bloqueado por el usuario')
    actionSuccess.value = `Usuario ${blockTargetId.value.trim()} bloqueado exitosamente.`
    blockTargetId.value = ''
    blockReason.value = ''
    await loadBlocked()
  } catch (err) {
    actionError.value = err.message || 'No se pudo bloquear al usuario.'
  } finally {
    blocking.value = false
  }
}

async function handleUnblockUser(userId) {
  blocking.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await unblockUser(userId)
    actionSuccess.value = `Usuario ${userId} desbloqueado.`
    await loadBlocked()
  } catch (err) {
    actionError.value = err.message || 'No se pudo desbloquear al usuario.'
  } finally {
    blocking.value = false
  }
}

onMounted(() => {
  loadBlocked()
})
</script>

<template>
  <section class="content-card messaging-center-card" aria-labelledby="messaging-heading">
    <div class="messaging-nav">
      <h2 id="messaging-heading">Centro de Mensajería y Privacidad</h2>
      <div class="tab-buttons">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'chat' }"
          @click="activeTab = 'chat'"
        >
          Mensajes y Exportación
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'blocks' }"
          @click="activeTab = 'blocks'"
        >
          Control de Bloqueos ({{ blockedUsers.length }})
        </button>
      </div>
    </div>

    <!-- Pestaña 1: Chat y Exportación (US18) -->
    <div v-if="activeTab === 'chat'" class="tab-panel">
      <div class="export-bar">
        <div class="conversation-input-wrap">
          <label for="conv-id">ID de Conversación Activa:</label>
          <input id="conv-id" v-model="conversationId" type="text" maxlength="64" />
        </div>
        <div class="export-actions">
          <button
            class="text-button"
            type="button"
            :disabled="exporting"
            @click="handleExportText"
          >
            {{ exporting ? 'Descargando…' : '📥 Descargar historial (.txt)' }}
          </button>
          <button
            class="text-button"
            type="button"
            :disabled="exporting"
            @click="handleExportJson"
          >
            {{ exporting ? 'Descargando…' : '📥 Exportar (.json)' }}
          </button>
        </div>
      </div>

      <form class="account-form message-form" novalidate :aria-busy="sending" @submit.prevent="handleSendMessage">
        <fieldset :disabled="sending">
          <legend>Enviar Mensaje Directo</legend>
          <div class="form-field">
            <label for="msg-recipient">ID de Usuario Destinatario (UUID)</label>
            <input
              id="msg-recipient"
              v-model="recipientId"
              type="text"
              placeholder="Ej. a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
              required
            />
          </div>
          <div class="form-field">
            <label for="msg-content">Mensaje</label>
            <textarea
              id="msg-content"
              v-model="messageText"
              rows="3"
              placeholder="Escribe tu consulta o mensaje sobre el inmueble..."
              maxlength="2000"
              required
            />
          </div>
          <button class="primary-button" type="submit">
            {{ sending ? 'Enviando…' : 'Enviar Mensaje' }}
          </button>
        </fieldset>
      </form>
    </div>

    <!-- Pestaña 2: Bloqueo de Usuarios (US17) -->
    <div v-else-if="activeTab === 'blocks'" class="tab-panel">
      <form class="account-form block-form" novalidate :aria-busy="blocking" @submit.prevent="handleBlockUser">
        <fieldset :disabled="blocking">
          <legend>Bloquear a un Usuario Indeseado</legend>
          <p class="field-help">Los usuarios bloqueados no podrán enviarte mensajes directos ni consultar tus datos de contacto.</p>
          <div class="form-field">
            <label for="block-target">ID de Usuario a Bloquear (UUID)</label>
            <input id="block-target" v-model="blockTargetId" type="text" placeholder="UUID del usuario" required />
          </div>
          <div class="form-field">
            <label for="block-reason">Motivo (opcional)</label>
            <input id="block-reason" v-model="blockReason" type="text" placeholder="Spam, contacto no solicitado, etc." maxlength="120" />
          </div>
          <button class="primary-button" type="submit">
            {{ blocking ? 'Bloqueando…' : 'Bloquear Usuario' }}
          </button>
        </fieldset>
      </form>

      <div class="blocked-list-container">
        <h3>Lista de Usuarios Bloqueados</h3>
        <p v-if="loadingBlocked" role="status">Cargando lista de bloqueos…</p>
        <p v-else-if="!blockedUsers.length" role="status">No tienes usuarios bloqueados actualmente.</p>
        <ul v-else class="blocked-items">
          <li v-for="b in blockedUsers" :key="b.id || b.blockedUserId" class="blocked-item">
            <div>
              <strong>Usuario: {{ b.blockedUserId }}</strong>
              <p class="field-help">Motivo: {{ b.reason || 'Sin motivo especificado' }}</p>
            </div>
            <button
              class="text-button"
              type="button"
              :disabled="blocking"
              @click="handleUnblockUser(b.blockedUserId)"
            >
              Desbloquear
            </button>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    <p v-if="actionSuccess" class="success-message" role="status">{{ actionSuccess }}</p>
  </section>
</template>

<style scoped>
.messaging-center-card {
  margin-top: 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}
.messaging-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
}
.tab-buttons {
  display: flex;
  gap: 0.5rem;
}
.tab-btn {
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.tab-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
.export-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
}
.conversation-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.conversation-input-wrap input {
  padding: 0.25rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 0.85rem;
}
.export-actions {
  display: flex;
  gap: 0.75rem;
}
.blocked-items {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}
.blocked-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}
</style>
