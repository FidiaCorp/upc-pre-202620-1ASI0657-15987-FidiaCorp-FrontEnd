import { clearSession, isAuthenticated, session } from '../account/session.js'

const baseUrl = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0, validationErrors = {}, code = null, retryAfter = 0) {
    super(message)
    this.status = status
    this.validationErrors = validationErrors || {}
    this.code = code
    this.retryAfter = retryAfter
  }
}

export async function request(path, { method = 'GET', body, authenticated = true } = {}) {
  if (authenticated && !isAuthenticated()) throw new ApiError('Tu sesión ha expirado. Ingresa nuevamente.', 401)
  const token = authenticated ? session.token : null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })
    const text = await response.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    if (!response.ok) {
      const credentialChallenge = ['/users/me/two-factor/setup', '/users/me/two-factor/confirm', '/users/me/two-factor/disable'].includes(path) && ['INVALID_CREDENTIALS', 'TWO_FACTOR_INVALID'].includes(data?.code)
      if (response.status === 401 && !credentialChallenge && token && session.token === token) clearSession()
      const fallback = response.status >= 500 ? 'El servidor no pudo completar la solicitud. Intenta nuevamente.' : 'No se pudo completar la solicitud.'
      throw new ApiError(response.status >= 500 ? fallback : data?.message || fallback, response.status, data?.validationErrors, data?.code, Math.max(0, Number(response.headers.get('Retry-After')) || 0))
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
