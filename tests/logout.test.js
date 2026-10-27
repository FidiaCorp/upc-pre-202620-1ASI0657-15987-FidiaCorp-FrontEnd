import test from 'node:test'
import assert from 'node:assert/strict'
import { clearSession, isAuthenticated, session, startSession } from '../src/account/session.js'
import { logout, logoutState, retryLogout } from '../src/account/logout.js'
import { request } from '../src/services/http.js'

const signIn = (token = 'current-token') => startSession({ token, expiresIn: 60000, email: 'user@example.com', roles: [] })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('logout clears local access immediately, sends current token only and blocks new private/login calls until completion', async () => {
  const previous = globalThis.fetch
  const response = deferred()
  try {
    signIn()
    let calls = 0
    globalThis.fetch = async (url, options) => {
      calls++
      assert.ok(url.endsWith('/auth/logout'))
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.Authorization, 'Bearer current-token')
      assert.equal(options.body, undefined)
      return response.promise
    }
    const closing = logout()
    assert.equal(session.token, null)
    assert.equal(session.user, null)
    assert.equal(isAuthenticated(), false)
    assert.equal(session.ending, true)
    await assert.rejects(request('/users/me'), error => error.code === 'SESSION_CHANGED')
    await assert.rejects(request('/auth/login', { authenticated: false }), error => error.code === 'SESSION_CHANGED')
    assert.equal(calls, 1)
    response.resolve(new Response(null, { status: 204 }))
    await closing
    assert.equal(session.ending, false)
    assert.equal(logoutState.pending, false)
    assert.equal(logoutState.warning, '')
  } finally { globalThis.fetch = previous; clearSession() }
})

test('an already invalid token (401) confirms lack of access without retaining retry', async () => {
  const previous = globalThis.fetch
  try {
    signIn()
    globalThis.fetch = async () => new Response(null, { status: 401 })
    await logout()
    assert.equal(session.token, null)
    assert.equal(logoutState.pending, false)
  } finally { globalThis.fetch = previous; clearSession() }
})

test('network and server failure keep only revocation retry; retry cannot restore or clear a newer session', async () => {
  const previous = globalThis.fetch
  try {
    for (const failure of ['network', 'server']) {
      signIn('old-token')
      globalThis.fetch = async () => {
        if (failure === 'network') throw new TypeError('offline')
        return new Response('{}', { status: 500 })
      }
      await logout()
      assert.equal(session.token, null)
      assert.equal(logoutState.pending, true)
      assert.match(logoutState.warning, /no confirmó/)
      signIn('new-token')
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/auth/logout'))
        assert.equal(options.headers.Authorization, 'Bearer old-token')
        return new Response(null, { status: 401 })
      }
      await retryLogout()
      assert.equal(session.token, 'new-token')
      assert.equal(logoutState.pending, false)
    }
  } finally { globalThis.fetch = previous; clearSession() }
})

test('late successful profile response is discarded after logout and cannot repopulate session', async () => {
  const previous = globalThis.fetch
  const profile = deferred()
  try {
    signIn()
    globalThis.fetch = async url => url.endsWith('/users/me') ? profile.promise : new Response(null, { status: 204 })
    const loading = request('/users/me')
    await logout()
    profile.resolve(new Response(JSON.stringify({ email: 'old@example.com' })))
    await assert.rejects(loading, error => error.code === 'SESSION_CHANGED')
    assert.equal(session.user, null)
  } finally { globalThis.fetch = previous; clearSession() }
})

test('late 401 from an earlier session cannot invalidate a new login', async () => {
  const previous = globalThis.fetch
  const profile = deferred()
  try {
    signIn('old-token')
    globalThis.fetch = async () => profile.promise
    const loading = request('/users/me')
    clearSession()
    signIn('new-token')
    profile.resolve(new Response('{}', { status: 401 }))
    await assert.rejects(loading, error => error.code === 'SESSION_CHANGED')
    assert.equal(session.token, 'new-token')
    assert.equal(isAuthenticated(), true)
  } finally { globalThis.fetch = previous; clearSession() }
})
