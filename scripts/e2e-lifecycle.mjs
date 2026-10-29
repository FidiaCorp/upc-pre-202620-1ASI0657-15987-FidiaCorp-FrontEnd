import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { readFile, stat } from 'node:fs/promises'

export function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, { detached: process.platform !== 'win32', ...options })
  // Retain startup errors instead of allowing an unhandled error event.
  child.startupError = null
  child.on('error', error => { child.startupError = error })
  return child
}
export function assertAlive(child, label) {
  if (child.startupError) throw new Error(`${label} no pudo iniciarse: ${child.startupError.code || 'error'}.`)
  if (child.exitCode !== null || child.signalCode !== null) throw new Error(`${label} terminó antes de estar listo.`)
}
function signalChild(child, signal) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal) } catch (error) {
    // A just-spawned child may not have created its detached group yet.
    if (['ESRCH', 'EPERM'].includes(error.code)) {
      try { child.kill(signal) } catch (directError) { if (directError.code !== 'ESRCH') throw directError }
    } else throw error
  }
}
export async function stopManaged(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return
  const closed = once(child, 'exit').catch(() => {})
  signalChild(child, 'SIGTERM')
  let timeout
  await Promise.race([closed, new Promise(resolve => { timeout = setTimeout(resolve, 5000) })])
  clearTimeout(timeout)
  if (child.exitCode === null && child.signalCode === null) { signalChild(child, 'SIGKILL'); await closed }
}
export async function waitUntil(check, { timeoutMs = 60000, signal, children = [] } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Ejecución interrumpida; se limpiarán los procesos de prueba.')
    for (const [child, label] of children) assertAlive(child, label)
    const result = await check()
    if (signal?.aborted) throw new Error('Ejecución interrumpida; se limpiarán los procesos de prueba.')
    for (const [child, label] of children) assertAlive(child, label)
    if (result) return result
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Se agotó el tiempo de inicio de los servicios de prueba.')
}
export async function waitManaged(child, { signal, timeoutMs = 240000 } = {}) {
  return new Promise((resolve, reject) => {
    let timer
    const finish = (error) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      child.removeListener('error', onError)
      child.removeListener('exit', onExit)
      if (error) reject(error); else resolve()
    }
    const onError = error => finish(new Error(`No se pudo iniciar el proceso: ${error.code || 'error'}.`))
    const onExit = (code, stoppedBy) => {
      if (signal?.aborted) finish(new Error('Ejecución interrumpida.'))
      else if (code === 0) finish()
      else finish(new Error(`El proceso terminó con ${stoppedBy || `código ${code}`}.`))
    }
    const onAbort = () => { signalChild(child, 'SIGTERM'); finish(new Error('Ejecución interrumpida.')) }
    child.once('error', onError)
    child.once('exit', onExit)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) { onAbort(); return }
    if (child.startupError) { onError(child.startupError); return }
    if (child.exitCode !== null || child.signalCode !== null) { onExit(child.exitCode, child.signalCode); return }
    timer = setTimeout(() => { signalChild(child, 'SIGTERM'); finish(new Error('Se agotó el tiempo del proceso de pruebas.')) }, timeoutMs)
  })
}
export async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}
export async function readFixtureManifest(path, expectedPid) {
  let file
  try { file = await stat(path) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
  if (process.platform !== 'win32' && (file.mode & 0o777) !== 0o600) throw new Error('El manifiesto debe ser privado (0600).')
  const data = JSON.parse(await readFile(path, 'utf8'))
  const url = new URL(data.apiBaseUrl)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/api/v1' || url.username || url.password || url.search || url.hash || data.pid !== expectedPid) throw new Error('El manifiesto no corresponde al fixture local supervisado.')
  for (const role of ['client', 'otherClient', 'realtor']) if (!data[role]?.id || !data[role]?.email || !data[role]?.password) throw new Error('El manifiesto del fixture está incompleto.')
  return data
}
