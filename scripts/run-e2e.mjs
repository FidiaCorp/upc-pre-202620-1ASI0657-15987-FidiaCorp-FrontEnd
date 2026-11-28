// Etapa 2: aceptación E2E contra el stack real de microservicios (docker compose) a través del API Gateway :8080.
// Crea cuentas desechables por la API pública, promueve al asesor con el fixture interno de identity (solo activo si
// el stack se levantó con E2E_FIXTURE_TOKEN), escribe un manifiesto privado 0600 e inicia Vite en un puerto aleatorio.
import { randomUUID } from 'node:crypto'
import { mkdtemp, chmod, open, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { assertAlive, freePort, readFixtureManifest, spawnManaged, stopManaged, validateGatewayApiBase, waitManaged, waitUntil } from './e2e-lifecycle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiBaseUrl = validateGatewayApiBase(process.env.E2E_API_BASE_URL || 'http://localhost:8080/api/v1')
const identityUrl = validateGatewayApiBase(`${(process.env.E2E_IDENTITY_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '')}/api/v1`)
const fixtureToken = process.env.E2E_FIXTURE_TOKEN || ''
const internalToken = process.env.E2E_INTERNAL_TOKEN || 'local-dev-only-internal-service-token-change-me'
const temporary = await mkdtemp(join(tmpdir(), 'fidiacorp-e2e-'))
await chmod(temporary, 0o700)
const abort = new AbortController()
const interrupt = () => abort.abort()
process.once('SIGINT', interrupt)
process.once('SIGTERM', interrupt)
const children = []
function checkInterrupted() { if (abort.signal.aborted) throw new Error('Ejecución interrumpida.') }

async function call(url, { method = 'GET', body, headers = {}, expected = [200] } = {}) {
  const response = await fetch(url, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) })
  const text = await response.text()
  if (!expected.includes(response.status)) throw new Error(`${method} ${new URL(url).pathname} respondió ${response.status}.`)
  return text ? JSON.parse(text) : null
}
async function account(label) {
  const credentials = { firstName: 'Fixture', lastName: label, email: `e2e-fixture-${label.toLowerCase()}-${randomUUID().replaceAll('-', '')}@example.com`, password: `E2e-${randomUUID().replaceAll('-', '')}!` }
  const profile = await call(`${apiBaseUrl}/auth/register`, { method: 'POST', body: credentials, expected: [201] })
  return { id: profile.id, firstName: credentials.firstName, email: credentials.email, password: credentials.password }
}

try {
  if (!fixtureToken) throw new Error('Define E2E_FIXTURE_TOKEN (el mismo valor con el que se levantó docker compose) para habilitar el fixture del asesor.')
  console.log(`E2E: esperando al API Gateway en ${new URL(apiBaseUrl).origin}.`)
  await waitUntil(async () => {
    try { return (await fetch(`${new URL(apiBaseUrl).origin}/actuator/health`, { signal: AbortSignal.timeout(2000) })).ok } catch { return false }
  }, { signal: abort.signal, timeoutMs: 240000 })
  checkInterrupted()
  const client = await account('Client')
  const otherClient = await account('Other')
  const realtor = await account('Realtor')
  await call(`${identityUrl}/internal/e2e/accounts/${encodeURIComponent(realtor.id)}/realtor`, { method: 'POST', headers: { 'X-Fixture-Token': fixtureToken, 'X-Internal-Token': internalToken } })
  const manifestPath = join(temporary, 'fixture.json')
  const manifest = await open(manifestPath, 'wx', 0o600)
  try { await manifest.writeFile(JSON.stringify({ apiBaseUrl, pid: process.pid, client, otherClient, realtor })) } finally { await manifest.close() }
  await readFixtureManifest(manifestPath, process.pid)
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  console.log('E2E: cuentas desechables listas; iniciando Vite en un puerto local aleatorio.')
  checkInterrupted()
  const vite = spawnManaged(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_BASE_URL: apiBaseUrl }, stdio: 'ignore' })
  children.push(vite)
  await waitUntil(async () => {
    try { return (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(1000) })).ok } catch { return false }
  }, { signal: abort.signal, children: [[vite, 'Vite']] })
  checkInterrupted()
  const runner = spawnManaged(process.execPath, [join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)], { cwd: root, env: { ...process.env, E2E_FIXTURE_MANIFEST: manifestPath, E2E_BASE_URL: baseURL }, stdio: 'inherit' })
  children.push(runner)
  console.log(`E2E: ejecutando Chrome contra ${apiBaseUrl}; no se muestran credenciales del fixture.`)
  await waitManaged(runner, { signal: abort.signal, timeoutMs: 900000 })
  assertAlive(vite, 'Vite')
} catch (error) {
  process.exitCode = abort.signal.aborted ? 130 : 1
  console.error(`E2E: ${error.message}`)
} finally {
  for (const child of [...children].reverse()) {
    try { await stopManaged(child) } catch { process.exitCode ||= 1; console.error('E2E: no se pudo detener un proceso dedicado; se continúa con la limpieza restante.') }
  }
  try { await rm(temporary, { recursive: true, force: true }) } catch { process.exitCode ||= 1; console.error('E2E: no se pudo eliminar el directorio temporal privado.') }
  process.removeListener('SIGINT', interrupt)
  process.removeListener('SIGTERM', interrupt)
  console.log('E2E: procesos dedicados detenidos y manifiesto privado eliminado.')
}
