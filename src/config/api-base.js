export function resolveApiBase(value, { production = false } = {}) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (production) throw new Error('VITE_API_BASE_URL es obligatoria al compilar. Usa /api/v1 con proxy del mismo origen o una URL HTTPS de la API.')
    return 'http://localhost:8080/api/v1'
  }
  if (/\s|\\|[?#]/u.test(raw)) throw new Error('VITE_API_BASE_URL no admite espacios, barras invertidas, consultas ni fragmentos.')
  if (raw === '/api/v1' || raw === '/api/v1/') return '/api/v1'
  if (!/^https?:\/\/[^/]/i.test(raw)) throw new Error('VITE_API_BASE_URL debe ser /api/v1 o una URL absoluta HTTP/HTTPS válida.')
  let url
  try { url = new URL(raw) } catch { throw new Error('VITE_API_BASE_URL debe ser /api/v1 o una URL absoluta válida.') }
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || !['/api/v1', '/api/v1/'].includes(url.pathname)) {
    throw new Error('VITE_API_BASE_URL debe usar HTTPS (HTTP solo para loopback), sin credenciales y con ruta /api/v1.')
  }
  return `${url.origin}/api/v1`
}
