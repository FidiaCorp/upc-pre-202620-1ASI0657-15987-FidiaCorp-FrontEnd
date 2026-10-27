import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidOtp, twoFactorError } from '../src/account/twoFactor.js'
import { clearSession, isAuthenticated, startSession } from '../src/account/session.js'
import { request } from '../src/services/http.js'

test('TOTP accepts exactly six digits and describes replay, expiry and unavailable cases', () => {
  assert.equal(isValidOtp('012345'), true)
  for (const value of ['', '12345', '1234567', 'ABCDEF', ' 12345']) assert.equal(isValidOtp(value), false)
  assert.match(twoFactorError({ code: 'TWO_FACTOR_INVALID' }), /ya utilizado/)
  assert.match(twoFactorError({ code: 'TWO_FACTOR_SETUP_EXPIRED' }), /venció/)
  assert.match(twoFactorError({ code: 'TWO_FACTOR_UNAVAILABLE' }), /no está disponible/)
})
test('only credential challenges on explicit two-factor management endpoints preserve the session', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const [path, code, preserved] of [
      ['/users/me/two-factor/setup', 'INVALID_CREDENTIALS', true],
      ['/users/me/two-factor/confirm', 'TWO_FACTOR_INVALID', true],
      ['/users/me/two-factor/disable', 'TWO_FACTOR_INVALID', true],
      ['/users/me/two-factor/setup', null, false],
      ['/users/me', 'INVALID_CREDENTIALS', false],
    ]) {
      startSession({ token: 'secret-token', expiresIn: 10000 })
      globalThis.fetch = async (_, options) => {
        assert.equal(options.cache, 'no-store')
        return new Response(JSON.stringify({ message: 'Rejected', code }), { status: 401 })
      }
      await assert.rejects(request(path), error => error.status === 401 && error.code === code)
      assert.equal(isAuthenticated(), preserved)
    }
  } finally { globalThis.fetch = originalFetch; clearSession() }
})
test('login OTP challenge and retry limit propagate codes without issuing a session', async () => {
  const originalFetch = globalThis.fetch
  clearSession()
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'TWO_FACTOR_REQUIRED', message: 'Code required' }), { status: 401 })
    await assert.rejects(request('/auth/login', { authenticated: false }), error => error.code === 'TWO_FACTOR_REQUIRED')
    assert.equal(isAuthenticated(), false)
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'TWO_FACTOR_LOCKED', message: 'Locked' }), { status: 429, headers: { 'Retry-After': '900' } })
    await assert.rejects(request('/auth/login', { authenticated: false }), error => error.code === 'TWO_FACTOR_LOCKED' && error.retryAfter === 900)
    assert.equal(isAuthenticated(), false)
  } finally { globalThis.fetch = originalFetch }
})
