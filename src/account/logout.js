import { reactive } from 'vue'
import { clearSession, session } from './session.js'
import { revokeToken } from '../services/http.js'

// Retained only in memory, never exposed to UI or used to restore authentication.
const pending = new Map()
export const logoutState = reactive({ busy: false, pending: false, warning: '', notice: '' })

async function revokePending() {
  logoutState.busy = true
  logoutState.notice = ''
  try {
    for (const [token, expiresAt] of [...pending]) {
      if (expiresAt > Date.now()) {
        try { await revokeToken(token) } catch { continue }
      }
      pending.delete(token)
    }
    logoutState.pending = pending.size > 0
    logoutState.warning = logoutState.pending
      ? 'El acceso local se eliminó, pero el servidor no confirmó la invalidación de la sesión anterior. Puedes reintentar mientras mantengas esta pestaña abierta.'
      : ''
    if (!logoutState.pending) logoutState.notice = 'La sesión anterior ya no permite acceso. Puedes ingresar nuevamente.'
  } finally { logoutState.busy = false }
}

export async function logout() {
  if (logoutState.busy) return
  const token = session.token
  const expiresAt = session.expiresAt
  session.ending = true
  if (token) pending.set(token, expiresAt)
  // Clear immediately so pending private responses cannot repopulate the profile.
  clearSession()
  logoutState.warning = ''
  logoutState.notice = 'Cerrando la sesión con el servidor…'
  try { await revokePending() } finally { session.ending = false }
}

export async function retryLogout() {
  if (logoutState.busy || !pending.size) return
  await revokePending()
}
