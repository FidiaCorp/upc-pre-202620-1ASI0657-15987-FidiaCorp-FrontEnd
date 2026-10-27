import { reactive } from 'vue'

const STORAGE_KEY = 'fidiacorp.session'
let expiryTimer
const storage = () => globalThis.sessionStorage

function readSession() {
  try {
    const value = JSON.parse(storage()?.getItem(STORAGE_KEY) || 'null')
    if (typeof value?.token === 'string' && value.token && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()) return value
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    try { storage()?.removeItem(STORAGE_KEY) } catch { /* Storage may be disabled. */ }
  }
  return null
}

const initial = readSession()
export const session = reactive({ token: initial?.token || null, expiresAt: initial?.expiresAt || 0, user: null, generation: 0, ending: false })

export function clearSession() {
  clearTimeout(expiryTimer)
  session.generation += 1
  session.token = null
  session.expiresAt = 0
  session.user = null
  try { storage()?.removeItem(STORAGE_KEY) } catch { /* Storage may be disabled. */ }
}

function scheduleExpiry() {
  clearTimeout(expiryTimer)
  if (session.token) {
    expiryTimer = setTimeout(clearSession, Math.min(session.expiresAt - Date.now(), 2147483647))
    expiryTimer.unref?.()
  }
}

export function isAuthenticated() {
  if (session.ending) return false
  if (session.token && session.expiresAt <= Date.now()) clearSession()
  return Boolean(session.token)
}

export function startSession(auth) {
  if (session.ending) throw new Error('Espera a que termine el cierre de sesión.')
  if (typeof auth.token !== 'string' || !auth.token || !Number.isFinite(auth.expiresIn) || auth.expiresIn <= 0) {
    throw new Error('La respuesta de acceso no contiene una sesión válida.')
  }
  session.generation += 1
  session.token = auth.token
  session.expiresAt = Date.now() + auth.expiresIn
  session.user = { email: auth.email, roles: auth.roles }
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify({ token: session.token, expiresAt: session.expiresAt })) } catch { /* Keep the session in memory. */ }
  scheduleExpiry()
}

scheduleExpiry()
