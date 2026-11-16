import { downloadFile, request } from '../services/http.js'

export const blockUser = (targetUserId, reason = 'Bloqueado por el usuario') =>
  request(`/messages/blocks/${encodeURIComponent(targetUserId)}`, {
    method: 'POST',
    body: { reason },
  })

export const unblockUser = (targetUserId) =>
  request(`/messages/blocks/${encodeURIComponent(targetUserId)}`, {
    method: 'DELETE',
  })

export const listBlockedUsers = () =>
  request('/messages/blocks')

export const sendMessage = ({ recipientId, content }) =>
  request('/messages', {
    method: 'POST',
    body: { recipientId, content },
  })

export const exportConversationText = (conversationId) =>
  downloadFile(
    `/messages/conversations/${encodeURIComponent(conversationId)}/export`,
    `historial_conversacion_${conversationId}.txt`
  )

export const exportConversationJson = (conversationId) =>
  downloadFile(
    `/messages/conversations/${encodeURIComponent(conversationId)}/export/json`,
    `historial_conversacion_${conversationId}.json`
  )
