import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync(new URL('../public/staticwebapp.config.json', import.meta.url), 'utf8'))

test('Static Web Apps: las rutas del router con historial HTML5 caen a index.html', () => {
  assert.equal(config.navigationFallback.rewrite, '/index.html')
})

test('Static Web Apps: assets, imágenes y /api nunca se reescriben a index.html', () => {
  for (const pattern of ['/assets/*', '/images/*', '/api/*']) {
    assert.ok(config.navigationFallback.exclude.includes(pattern), `falta excluir ${pattern}`)
  }
  assert.equal(config.responseOverrides, undefined, 'un 404 de asset debe seguir siendo 404')
})

test('Static Web Apps: cabeceras de seguridad y caché alineadas con deploy/nginx.conf', () => {
  assert.equal(config.globalHeaders['X-Content-Type-Options'], 'nosniff')
  assert.equal(config.globalHeaders['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.equal(config.globalHeaders['X-Frame-Options'], 'DENY')
  const cache = Object.fromEntries(config.routes.map((r) => [r.route, r.headers['Cache-Control']]))
  assert.equal(cache['/index.html'], 'no-store')
  assert.match(cache['/assets/*'], /immutable/)
})
