import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiBase } from '../src/config/api-base.js'

test('production requires an explicit public API and normalizes supported endpoints', () => {
  assert.throws(() => resolveApiBase(undefined, { production: true }), /obligatoria/)
  assert.throws(() => resolveApiBase('  ', { production: true }), /obligatoria/)
  assert.equal(resolveApiBase(undefined), 'http://localhost:8080/api/v1')
  assert.equal(resolveApiBase('/api/v1/', { production: true }), '/api/v1')
  assert.equal(resolveApiBase('https://api.example.com/api/v1/', { production: true }), 'https://api.example.com/api/v1')
  assert.equal(resolveApiBase('http://127.0.0.1:49152/api/v1', { production: true }), 'http://127.0.0.1:49152/api/v1')
  assert.equal(resolveApiBase('http://[::1]:8080/api/v1'), 'http://[::1]:8080/api/v1')
})
test('invalid, remote plaintext and credential-bearing API values are rejected', () => {
  for (const value of ['//api.example.com/api/v1', 'https:api.example.com/api/v1', 'https:///api.example.com/api/v1', 'http://127.0.0.1.evil.example/api/v1', 'http://127.example.com/api/v1', 'http://localhost.evil/api/v1', 'javascript:alert(1)', 'https://user:secret@example.com/api/v1', 'http://api.example.com/api/v1', 'http://192.168.1.10/api/v1', 'https://api.example.com/other', 'https://api.example.com/api/v1?token=test', 'https://api.example.com/api/v1#secret', 'https://api.example.com\\api\\v1', '/api/v1 child']) {
    assert.throws(() => resolveApiBase(value, { production: true }), undefined, value)
  }
})
