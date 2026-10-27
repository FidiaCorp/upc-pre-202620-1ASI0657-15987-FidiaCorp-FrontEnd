import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProfile, safeRedirect, validateAccount } from '../src/account/validation.js'
import { clearSession, isAuthenticated, session, startSession } from '../src/account/session.js'
import { ApiError, request } from '../src/services/http.js'

test('profile validation rejects whitespace and malformed email, and normalizes valid data', () => {
  assert.deepEqual(Object.keys(validateAccount({ firstName: ' ', lastName: '', email: 'wrong' }, { names: true })), ['firstName', 'lastName', 'email'])
  assert.deepEqual(normalizeProfile({ firstName: ' Ana ', lastName: ' Díaz ', email: ' ANA@EXAMPLE.COM ' }), { firstName: 'Ana', lastName: 'Díaz', email: 'ana@example.com' })
})
test('registration accounts for UTF-8 byte limit, login accepts existing short passwords', () => {
  assert.ok(validateAccount({ email: 'a@example.com', password: 'é'.repeat(37) }, { registration: true }).password)
  assert.ok(validateAccount({ email: 'a@example.com', password: 'short' }, { registration: true }).password)
  assert.deepEqual(validateAccount({ email: 'a@example.com', password: 'short' }), {})
})
test('redirect rejects external, protocol relative and login loops', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/login', '/register?x=1', ['home']]) assert.equal(safeRedirect(value), '/profile')
  assert.equal(safeRedirect('/products?tab=1'), '/products?tab=1')
})
test('session expiry and authenticated HTTP attach token; 401 invalidates, errors preserve field details', async () => {
  const originalFetch = globalThis.fetch
  try {
    startSession({ token: 'test-token', expiresIn: 10000, email: 'a@example.com', roles: [] })
    assert.equal(isAuthenticated(), true)
    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      assert.ok(url.endsWith('/users/me'))
      return new Response(JSON.stringify({ message: 'Invalid', validationErrors: { email: 'Invalid email' } }), { status: 400 })
    }
    await assert.rejects(request('/users/me'), error => error instanceof ApiError && error.validationErrors.email === 'Invalid email')
    assert.equal(isAuthenticated(), true)
    globalThis.fetch = async () => new Response('{}', { status: 401 })
    await assert.rejects(request('/users/me'), { status: 401 })
    assert.equal(isAuthenticated(), false)
    assert.equal(session.user, null)
    startSession({ token: 'expired', expiresIn: 1000 })
    session.expiresAt = Date.now() - 1
    assert.equal(isAuthenticated(), false)
  } finally { globalThis.fetch = originalFetch; clearSession() }
})
test('login 401 does not send token; network error remains retryable', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (_, options) => {
      assert.equal(options.headers.Authorization, undefined)
      return new Response('{}', { status: 401 })
    }
    await assert.rejects(request('/auth/login', { authenticated: false, method: 'POST', body: { email: 'a@example.com', password: 'wrong' } }), { status: 401 })
    globalThis.fetch = async () => { throw new TypeError('failed') }
    await assert.rejects(request('/auth/register', { authenticated: false }), /No se pudo conectar/)
  } finally { globalThis.fetch = originalFetch }
})
test('sessionStorage restores only a valid session and persists no password or profile', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  let stored = null
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: () => stored,
    setItem: (_, value) => { stored = value },
    removeItem: () => { stored = null },
  } })
  try {
    for (const [index, value] of ['broken json', JSON.stringify({ token: 'expired', expiresAt: Date.now() - 1 }), JSON.stringify({ token: {}, expiresAt: Date.now() + 10000 })].entries()) {
      stored = value
      const state = await import(`../src/account/session.js?invalid=${index}`)
      assert.equal(state.isAuthenticated(), false)
      assert.equal(stored, null)
    }
    stored = JSON.stringify({ token: 'restored', expiresAt: Date.now() + 10000 })
    const state = await import('../src/account/session.js?valid')
    assert.equal(state.isAuthenticated(), true)
    assert.equal(state.session.token, 'restored')
    state.startSession({ token: 'next', expiresIn: 10000, email: 'user@example.com', password: 'never-save' })
    assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['expiresAt', 'token'])
    state.clearSession()
  } finally {
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous)
    else delete globalThis.sessionStorage
  }
})
