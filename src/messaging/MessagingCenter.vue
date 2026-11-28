<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getProfile } from '../account/api.js'
import { session } from '../account/session.js'
import { formatDate } from '../offers/format.js'
import {
  blockUser, exportConversationJson, exportConversationText, isUuid, listBlockedUsers, listConversations, listMessages,
  sendMessage, startConversation, threadView, unblockUser,
} from './api.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'

const route = useRoute()
const activeTab = ref('chat') // 'chat' | 'blocks'
const conversations = ref([])
const selectedId = ref('')
const messages = ref([])
const loadingInbox = ref(false)
const loadingThread = ref(false)
const messageText = ref('')
const newRecipientId = ref('')
const sending = ref(false)
const exporting = ref(false)
const actionError = ref('')
const actionSuccess = ref('')
const blockedUsers = ref([])
const loadingBlocked = ref(false)
const blockTargetId = ref('')
const blockReason = ref('')
const blocking = ref(false)
let disposed = false

const ownId = computed(() => session.user?.id)
const selected = computed(() => conversations.value.find(c => c.conversationId === selectedId.value) || null)
const thread = computed(() => threadView(messages.value, ownId.value))

const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?'
function fail(err, fallback) { if (!disposed) actionError.value = err.message || fallback }

async function ensureIdentity() {
  if (!ownId.value) { try { session.user = await getProfile() } catch { /* La lista sigue funcionando sin distinguir autoría. */ } }
}
async function loadInbox() {
  loadingInbox.value = true
  try {
    const list = await listConversations()
    if (disposed) return
    conversations.value = Array.isArray(list) ? list : []
    const requested = typeof route.query.conversation === 'string' ? route.query.conversation : ''
    if (isUuid(requested) && conversations.value.some(c => c.conversationId === requested)) selectedId.value = requested
    else if (!selected.value && conversations.value.length) selectedId.value = conversations.value[0].conversationId
  } catch (err) { fail(err, 'No se pudo cargar la bandeja de conversaciones.') } finally { if (!disposed) loadingInbox.value = false }
}
async function loadThread() {
  if (!selectedId.value) { messages.value = []; return }
  loadingThread.value = true
  try {
    const list = await listMessages(selectedId.value)
    if (!disposed) messages.value = Array.isArray(list) ? list : []
  } catch (err) { fail(err, 'No se pudieron cargar los mensajes.') } finally { if (!disposed) loadingThread.value = false }
}
async function loadBlocked() {
  loadingBlocked.value = true
  try {
    const list = await listBlockedUsers()
    if (!disposed) blockedUsers.value = Array.isArray(list) ? list : []
  } catch (err) { fail(err, 'No se pudo cargar la lista de bloqueados.') } finally { if (!disposed) loadingBlocked.value = false }
}

async function handleNewConversation() {
  actionError.value = ''
  actionSuccess.value = ''
  if (!isUuid(newRecipientId.value)) { actionError.value = 'Ingresa el UUID de la cuenta destinataria.'; return }
  sending.value = true
  try {
    const conversation = await startConversation({ recipientId: newRecipientId.value.trim() })
    newRecipientId.value = ''
    await loadInbox()
    selectedId.value = conversation.conversationId
  } catch (err) { fail(err, 'No se pudo iniciar la conversación.') } finally { sending.value = false }
}
async function handleSendMessage() {
  actionError.value = ''
  actionSuccess.value = ''
  if (!selected.value || !messageText.value.trim()) { actionError.value = 'Selecciona una conversación y escribe un mensaje.'; return }
  sending.value = true
  try {
    await sendMessage({ conversationId: selected.value.conversationId, content: messageText.value.trim() })
    messageText.value = ''
    actionSuccess.value = 'Mensaje enviado correctamente.'
    await Promise.all([loadThread(), loadInbox()])
  } catch (err) {
    fail(err, 'No se pudo enviar el mensaje.')
  } finally { sending.value = false }
}
async function handleExport(kind) {
  if (!selected.value) return
  exporting.value = true
  actionError.value = ''
  try {
    if (kind === 'txt') await exportConversationText(selected.value.conversationId)
    else await exportConversationJson(selected.value.conversationId)
  } catch (err) { fail(err, 'Error al exportar la conversación.') } finally { exporting.value = false }
}
async function block(targetId, reason) {
  blocking.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const result = await blockUser(targetId, reason || 'Bloqueado por el usuario')
    actionSuccess.value = `Usuario ${result.blockedId} bloqueado exitosamente.`
    await loadBlocked()
  } catch (err) { fail(err, 'No se pudo bloquear al usuario.') } finally { blocking.value = false }
}
async function handleBlockUser() {
  if (!isUuid(blockTargetId.value)) { actionError.value = 'Ingresa el UUID del usuario a bloquear.'; return }
  await block(blockTargetId.value.trim(), blockReason.value.trim())
  if (!actionError.value) { blockTargetId.value = ''; blockReason.value = '' }
}
async function handleUnblockUser(blockedId) {
  blocking.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await unblockUser(blockedId)
    actionSuccess.value = `Usuario ${blockedId} desbloqueado.`
    await loadBlocked()
  } catch (err) { fail(err, 'No se pudo desbloquear al usuario.') } finally { blocking.value = false }
}

watch(selectedId, () => { actionSuccess.value = ''; loadThread() })
watch(() => route.query.conversation, value => { if (isUuid(value)) { activeTab.value = 'chat'; loadInbox() } })
onMounted(async () => { await ensureIdentity(); await Promise.all([loadInbox(), loadBlocked()]) })
onUnmounted(() => { disposed = true })
</script>

<template>
  <section class="content-card messaging-center-card" aria-labelledby="messaging-heading">
    <div class="messaging-nav">
      <div>
        <h2 id="messaging-heading">Centro de Mensajería y Privacidad</h2>
        <p class="field-help">Conversa con propietarios y asesores, exporta el historial y controla a quién bloqueas.</p>
      </div>
      <div class="tab-buttons">
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'chat' }" :aria-pressed="activeTab === 'chat'" @click="activeTab = 'chat'"><AppIcon name="message" :size="15" />Conversaciones ({{ conversations.length }})</button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'blocks' }" :aria-pressed="activeTab === 'blocks'" @click="activeTab = 'blocks'"><AppIcon name="ban" :size="15" />Control de Bloqueos ({{ blockedUsers.length }})</button>
      </div>
    </div>

    <div v-if="activeTab === 'chat'" class="tab-panel chat-layout">
      <aside class="inbox" aria-labelledby="inbox-heading">
        <h3 id="inbox-heading">Bandeja</h3>
        <p v-if="loadingInbox" role="status">Cargando conversaciones…</p>
        <p v-else-if="!conversations.length" class="field-help">Aún no tienes conversaciones. Usa «Contactar» en un inmueble del catálogo.</p>
        <ul class="conversation-list">
          <li v-for="c in conversations" :key="c.conversationId">
            <button type="button" class="conversation-item" :class="{ active: c.conversationId === selectedId }" :aria-pressed="c.conversationId === selectedId" @click="selectedId = c.conversationId">
              <span class="chat-avatar" aria-hidden="true">{{ initials(c.counterpartName) }}</span>
              <span class="conversation-text">
                <strong>{{ c.counterpartName }}</strong>
                <span class="field-help">{{ c.messageCount }} mensaje(s){{ c.propertyId ? ' · sobre un inmueble' : '' }}</span>
                <span v-if="c.lastMessagePreview" class="field-help preview">{{ c.lastMessagePreview }}</span>
              </span>
            </button>
          </li>
        </ul>
        <form class="account-form new-conversation" novalidate @submit.prevent="handleNewConversation">
          <label for="new-recipient">Nueva conversación (UUID de la cuenta)</label>
          <div class="inline-field"><input id="new-recipient" v-model="newRecipientId" class="input" type="text" autocomplete="off" placeholder="UUID del destinatario" /><button class="secondary-button" type="submit" :disabled="sending">Iniciar conversación</button></div>
        </form>
      </aside>

      <div class="thread" aria-live="polite">
        <template v-if="selected">
          <div class="export-bar">
            <div class="thread-head">
              <span class="chat-avatar large" aria-hidden="true">{{ initials(selected.counterpartName) }}</span>
              <div>
                <p class="thread-title">Conversación con <strong>{{ selected.counterpartName }}</strong></p>
                <code class="conversation-id">{{ selected.conversationId }}</code>
              </div>
            </div>
            <div class="export-actions">
              <button class="secondary-button" type="button" :disabled="exporting" @click="handleExport('txt')"><AppIcon name="download" :size="15" />{{ exporting ? 'Descargando…' : 'Descargar historial (.txt)' }}</button>
              <button class="secondary-button" type="button" :disabled="exporting" @click="handleExport('json')"><AppIcon name="file" :size="15" />{{ exporting ? 'Descargando…' : 'Exportar (.json)' }}</button>
              <button class="text-button danger-text" type="button" :disabled="blocking" @click="block(selected.counterpartId, 'Bloqueado desde la conversación')"><AppIcon name="ban" :size="15" />Bloquear contacto</button>
            </div>
          </div>
          <p v-if="loadingThread" role="status">Cargando mensajes…</p>
          <p v-else-if="!thread.length" class="field-help empty-thread">Todavía no hay mensajes. Escribe el primero.</p>
          <ol class="message-list">
            <li v-for="m in thread" :key="m.id" class="message" :class="m.incoming ? 'message-incoming' : 'message-outgoing'">
              <span class="message-author">{{ m.incoming ? m.author : 'Tú' }}</span>
              <p class="message-content">{{ m.content }}</p>
              <time class="message-time">{{ formatDate(m.sentAt) }}</time>
            </li>
          </ol>
          <form class="account-form message-form" novalidate :aria-busy="sending" @submit.prevent="handleSendMessage">
            <fieldset :disabled="sending">
              <label for="msg-content">Mensaje</label>
              <div class="composer">
                <textarea id="msg-content" v-model="messageText" class="input" rows="2" maxlength="2000" placeholder="Escribe tu consulta sobre el inmueble…" required />
                <button class="primary-button" type="submit"><AppIcon name="send" :size="16" />{{ sending ? 'Enviando…' : 'Enviar Mensaje' }}</button>
              </div>
            </fieldset>
          </form>
        </template>
        <p v-else class="field-help empty-thread">Selecciona una conversación de la bandeja.</p>
      </div>
    </div>

    <div v-else-if="activeTab === 'blocks'" class="tab-panel blocks-layout">
      <form class="account-form block-form" novalidate :aria-busy="blocking" @submit.prevent="handleBlockUser">
        <fieldset :disabled="blocking">
          <legend>Bloquear a un Usuario Indeseado</legend>
          <p class="field-help">Los usuarios bloqueados no podrán iniciar conversaciones ni enviarte mensajes.</p>
          <div class="form-field">
            <label for="block-target">ID de Usuario a Bloquear (UUID)</label>
            <input id="block-target" v-model="blockTargetId" type="text" placeholder="UUID del usuario" required />
          </div>
          <div class="form-field">
            <label for="block-reason">Motivo (opcional)</label>
            <input id="block-reason" v-model="blockReason" type="text" placeholder="Spam, contacto no solicitado, etc." maxlength="250" />
          </div>
          <button class="primary-button" type="submit"><AppIcon name="ban" :size="16" />{{ blocking ? 'Bloqueando…' : 'Bloquear Usuario' }}</button>
        </fieldset>
      </form>
      <div class="blocked-list-container">
        <h3>Lista de Usuarios Bloqueados</h3>
        <p v-if="loadingBlocked" role="status">Cargando lista de bloqueos…</p>
        <p v-else-if="!blockedUsers.length" class="empty-state">No tienes usuarios bloqueados actualmente.</p>
        <ul v-else class="blocked-items">
          <li v-for="b in blockedUsers" :key="b.blockId" class="blocked-item">
            <span class="chat-avatar muted" aria-hidden="true"><AppIcon name="ban" :size="16" /></span>
            <div class="blocked-text">
              <strong>Usuario: {{ b.blockedId }}</strong>
              <p class="field-help">Motivo: {{ b.reason || 'Sin motivo especificado' }} · {{ formatDate(b.createdAt) }}</p>
            </div>
            <button class="secondary-button" type="button" :disabled="blocking" @click="handleUnblockUser(b.blockedId)">Desbloquear</button>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    <p v-if="actionSuccess" class="success-message" role="status">{{ actionSuccess }}</p>
  </section>
</template>

<style scoped>
.messaging-center-card { margin-top: 24px; }
.messaging-nav { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; border-bottom: 1px solid var(--cc-border); padding-bottom: 14px; }
.messaging-nav h2 { margin: 0; }
.tab-buttons { display: inline-flex; gap: 4px; padding: 4px; background: #f1f5f9; border-radius: 12px; }
.tab-btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 0; border-radius: 9px; padding: 8px 14px; font-size: 13.5px; font-weight: 600; color: var(--cc-text-2); cursor: pointer; }
.tab-btn.active { background: #fff; color: var(--cc-navy); box-shadow: 0 1px 3px rgba(15, 23, 42, .12); }
.chat-layout { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 0; border: 1px solid var(--cc-border); border-radius: var(--cc-radius); overflow: hidden; min-height: 460px; }
@media (max-width: 860px) { .chat-layout { grid-template-columns: 1fr; } .inbox { border-right: 0 !important; border-bottom: 1px solid var(--cc-border); } }
.inbox { background: var(--cc-canvas); border-right: 1px solid var(--cc-border); padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.inbox h3 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--cc-text-3); }
.conversation-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.conversation-item { width: 100%; text-align: left; display: flex; gap: 10px; align-items: flex-start; padding: 10px; border: 1px solid transparent; border-radius: 10px; background: transparent; cursor: pointer; color: var(--cc-text); font: inherit; }
.conversation-item:hover { background: #fff; border-color: var(--cc-border); }
.conversation-item.active { border-color: var(--cc-soft-border); background: var(--cc-soft); }
.conversation-text { display: grid; gap: 2px; min-width: 0; }
.conversation-text .field-help { margin: 0; }
.preview { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-avatar { flex: none; display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 999px; background: var(--cc-navy); color: #fff; font-size: 12.5px; font-weight: 700; }
.chat-avatar.large { width: 40px; height: 40px; font-size: 14px; }
.chat-avatar.muted { background: #f1f5f9; color: var(--cc-text-3); }
.new-conversation { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--cc-border); }
.new-conversation label { font-size: 12.5px; font-weight: 600; color: var(--cc-text-2); }
.inline-field { display: grid; gap: 6px; margin-top: 6px; }
.thread { display: flex; flex-direction: column; min-width: 0; background: #fff; }
.export-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--cc-border); }
.thread-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.thread-title { margin: 0; font-size: 14.5px; }
.export-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.export-actions .secondary-button, .export-actions .text-button { padding: 6px 12px; font-size: 13px; }
.conversation-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: var(--cc-text-3); overflow-wrap: anywhere; }
.empty-thread { padding: 24px 16px; }
.message-list { list-style: none; padding: 16px; margin: 0; display: flex; flex-direction: column; gap: 10px; max-height: 360px; min-height: 200px; overflow-y: auto; background: linear-gradient(180deg, #fbfdff, #fff); flex: 1; }
.message { padding: 10px 14px; border-radius: 16px; max-width: min(78%, 560px); display: grid; gap: 2px; }
.message-incoming { background: #f1f5f9; color: var(--cc-text); align-self: flex-start; border-bottom-left-radius: 4px; }
.message-outgoing { background: #dbeafe; color: #1e3a8a; align-self: flex-end; border-bottom-right-radius: 4px; }
.message-author { font-weight: 700; font-size: 12px; opacity: .8; }
.message-content { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; }
.message-time { font-size: 11px; opacity: .7; justify-self: end; }
.message-form { margin: 0; padding: 12px 16px 16px; border-top: 1px solid var(--cc-border); background: #fff; }
.message-form label { font-size: 12.5px; font-weight: 600; color: var(--cc-text-2); }
.composer { display: flex; gap: 10px; align-items: flex-end; margin-top: 6px; }
.composer textarea { flex: 1; min-width: 0; resize: vertical; }
@media (max-width: 560px) { .composer { flex-direction: column; align-items: stretch; } }
.blocks-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 20px; align-items: start; }
@media (max-width: 860px) { .blocks-layout { grid-template-columns: 1fr; } }
.block-form { border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 18px; background: var(--cc-canvas); margin: 0; }
.blocked-list-container h3 { margin-top: 0; font-size: 15px; }
.blocked-items { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.blocked-item { display: flex; gap: 12px; align-items: center; padding: 12px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); }
.blocked-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.blocked-text p { margin: 2px 0 0; }
</style>
