import { resolveApiBase } from '../config/api-base.js'
import { clearSession, isAuthenticated, session } from '../account/session.js'

const baseUrl = resolveApiBase(import.meta.env?.VITE_API_BASE_URL, { production: import.meta.env?.PROD === true })

export class ApiError extends Error {
  constructor(message, status = 0, validationErrors = {}, code = null, retryAfter = 0, body = null) {
    super(message)
    this.status = status
    this.validationErrors = validationErrors || {}
    this.code = code
    this.retryAfter = retryAfter
    // Cuerpo JSON real de la respuesta (RFC 7807 ProblemDetail o DTO de negocio, p. ej. 402 de /payments/checkout).
    this.body = body
  }
}

export async function request(path, { method = 'GET', body, authenticated = true } = {}) {
  if (session.ending && (authenticated || path === '/auth/login')) throw new ApiError('Espera a que termine el cierre de sesión.', 409, {}, 'SESSION_CHANGED')
  if (authenticated && !isAuthenticated()) throw new ApiError('Tu sesión ha expirado. Ingresa nuevamente.', 401)
  const generation = session.generation
  const token = authenticated ? session.token : null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })
    const text = await response.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    if ((authenticated || path === '/auth/login') && (session.generation !== generation || session.ending)) {
      throw new ApiError('La sesión cambió. Se descartó la respuesta anterior.', 409, {}, 'SESSION_CHANGED')
    }
    if (!response.ok) {
      const credentialChallenge = ['/users/me/two-factor/setup', '/users/me/two-factor/confirm', '/users/me/two-factor/disable'].includes(path) && ['INVALID_CREDENTIALS', 'TWO_FACTOR_INVALID'].includes(data?.code)
      if (response.status === 401 && !credentialChallenge && token && session.token === token) clearSession()
      const fallback = response.status >= 500 ? 'El servidor no pudo completar la solicitud. Intenta nuevamente.' : 'No se pudo completar la solicitud.'
      throw new ApiError(response.status >= 500 ? fallback : data?.message || data?.detail || fallback, response.status, data?.validationErrors, data?.code, Math.max(0, Number(response.headers.get('Retry-After')) || 0), data)
    }
    if (text && data === null) throw new ApiError('El servidor devolvió una respuesta inesperada.')
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error.name === 'AbortError' ? 'La solicitud tardó demasiado. Intenta nuevamente.' : 'No se pudo conectar con el servidor. Comprueba tu conexión e intenta nuevamente.')
  } finally {
    clearTimeout(timeout)
  }
}

export async function downloadFile(path, filename, { authenticated = true } = {}) {
  if (session.ending && authenticated) throw new ApiError('Espera a que termine el cierre de sesión.', 409, {}, 'SESSION_CHANGED')
  if (authenticated && !isAuthenticated()) throw new ApiError('Tu sesión ha expirado. Ingresa nuevamente.', 401)
  const token = authenticated ? session.token : null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      // RFC 7807: p. ej. 409 si el snapshot de la versión no supera la verificación SHA-256 (US22).
      let problem = null
      try { problem = JSON.parse(await response.text()) } catch { problem = null }
      const detail = response.status < 500 ? problem?.message || problem?.detail : null
      throw new ApiError(detail || `Error al descargar archivo: ${response.statusText || response.status}`, response.status, problem?.validationErrors, problem?.code)
    }
    const blob = await response.blob()
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }
    return blob
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error.name === 'AbortError' ? 'La descarga tardó demasiado. Intenta nuevamente.' : 'No se pudo descargar el archivo. Comprueba tu conexión.')
  } finally {
    clearTimeout(timeout)
  }
}

// The retained token can only be used to revoke that specific session.
export async function revokeToken(token) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (response.status !== 204 && response.status !== 401) throw new ApiError('El servidor no confirmó la invalidación.', response.status)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('No se pudo confirmar la invalidación con el servidor.')
  } finally { clearTimeout(timeout) }
}
