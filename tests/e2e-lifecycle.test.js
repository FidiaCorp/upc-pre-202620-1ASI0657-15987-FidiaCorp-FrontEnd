import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { readFixtureManifest, spawnManaged, stopManaged, waitManaged, waitUntil } from '../scripts/e2e-lifecycle.mjs'

const child = script => spawnManaged(process.execPath, ['-e', script], { stdio: 'ignore' })
test('managed process resolves success and reports an already terminated failure immediately', async () => {
  const success = child('process.exit(0)')
  await waitManaged(success, { timeoutMs: 5000 })
  const failure = child('process.exit(7)')
  await once(failure, 'exit')
  await assert.rejects(waitManaged(failure, { timeoutMs: 5000 }), /código 7/)
})
test('startup errors and an already aborted signal do not wait for the startup timeout', async () => {
  const missing = spawnManaged(join(tmpdir(), 'fidiacorp-missing-executable'), [], { stdio: 'ignore' })
  await once(missing, 'error')
  await assert.rejects(waitManaged(missing, { timeoutMs: 5000 }), /ENOENT/)
  const running = child('setInterval(() => {}, 1000)')
  const controller = new AbortController()
  controller.abort()
  try { await assert.rejects(waitManaged(running, { signal: controller.signal, timeoutMs: 5000 }), /interrumpida/) } finally { await stopManaged(running) }
  assert.ok(running.exitCode !== null || running.signalCode !== null)
})
test('startup timeout and premature exit are reported; signal cleanup stops the dedicated child', async () => {
  await assert.rejects(waitUntil(async () => false, { timeoutMs: 20 }), /tiempo de inicio/)
  const premature = child('process.exit(1)')
  await once(premature, 'exit')
  await assert.rejects(waitUntil(async () => false, { children: [[premature, 'Fixture']] }), /terminó antes/)
  const running = child('setInterval(() => {}, 1000)')
  const controller = new AbortController()
  const completion = waitManaged(running, { signal: controller.signal })
  controller.abort()
  await assert.rejects(completion, /interrumpida/)
  await stopManaged(running)
  assert.ok(running.signalCode || running.exitCode !== null)
})
test('fixture manifest accepts only the supervised loopback process and private file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fidiacorp-manifest-unit-'))
  const path = join(directory, 'fixture.json')
  const account = { id: 'id', email: 'disposable@example.com', password: 'temporary-test-only' }
  const manifest = { apiBaseUrl: 'http://127.0.0.1:45678/api/v1', pid: process.pid, client: account, otherClient: account, realtor: account }
  try {
    assert.equal(await readFixtureManifest(path, process.pid), null)
    await writeFile(path, JSON.stringify(manifest), { mode: 0o600 })
    assert.equal((await readFixtureManifest(path, process.pid)).pid, process.pid)
    await assert.rejects(readFixtureManifest(path, process.pid + 1), /fixture local/)
    if (process.platform !== 'win32') {
      await chmod(path, 0o644)
      await assert.rejects(readFixtureManifest(path, process.pid), /0600/)
      await chmod(path, 0o600)
    }
    await writeFile(path, JSON.stringify({ ...manifest, apiBaseUrl: 'https://example.com/api/v1' }))
    await assert.rejects(readFixtureManifest(path, process.pid), /fixture local/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
