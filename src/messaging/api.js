import { downloadFile, request } from '../services/http.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid = value => typeof value === 'string' && UUID.test(value.trim())
const requireUuid = (value, field) => {
  if (!isUuid(value)) throw new TypeError(`${field} debe ser un UUID válido.`)
  return value.trim()
}

// US17 — bloqueos. Respuesta real: UserBlockResponse { blockId, blockerId, blockedId, reason, createdAt, message }.
export const blockUser = (targetUserId, reason = 'Bloqueado por el usuario') =>
  request(`/messages/blocks/${encodeURIComponent(requireUuid(targetUserId, 'targetUserId'))}`, { method: 'POST', body: { reason } })
export const unblockUser = (targetUserId) =>
  request(`/messages/blocks/${encodeURIComponent(requireUuid(targetUserId, 'targetUserId'))}`, { method: 'DELETE' })
export const listBlockedUsers = () => request('/messages/blocks')

// US16 — conversaciones reales con UUID. Respuesta: ConversationResponse.
export const startConversation = ({ recipientId, propertyId = null }) =>
  request('/messages/conversations', {
    method: 'POST',
    body: { recipientId: requireUuid(recipientId, 'recipientId'), ...(propertyId ? { propertyId: requireUuid(propertyId, 'propertyId') } : {}) },
  })
export const listConversations = () => request('/messages/conversations')
export const listMessages = (conversationId) =>
  request(`/messages/conversations/${encodeURIComponent(requireUuid(conversationId, 'conversationId'))}/messages`)
export const sendMessage = ({ conversationId, content, recipientId = null }) =>
  request('/messages', {
    method: 'POST',
    body: { conversationId: requireUuid(conversationId, 'conversationId'), content, ...(recipientId ? { recipientId } : {}) },
  })

// US18 — exportaciones (UUID real de la conversación).
export const exportConversationText = (conversationId) =>
  downloadFile(`/messages/conversations/${encodeURIComponent(requireUuid(conversationId, 'conversationId'))}/export`,
    `historial_conversacion_${conversationId}.txt`)
export const exportConversationJson = (conversationId) =>
  downloadFile(`/messages/conversations/${encodeURIComponent(requireUuid(conversationId, 'conversationId'))}/export/json`,
    `historial_conversacion_${conversationId}.json`)

/** Vista: separa mensajes enviados y recibidos para el usuario autenticado. */
export function threadView(messages, ownId) {
  return (Array.isArray(messages) ? messages : []).map(m => ({
    id: m.messageId,
    author: m.senderName,
    content: m.content,
    sentAt: m.sentAt,
    incoming: Boolean(ownId) && m.senderId !== ownId,
  }))
}
