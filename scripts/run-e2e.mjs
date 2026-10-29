import { mkdtemp, chmod, copyFile, mkdir, open, readFile, rm } from 'node:fs/promises'
import { dirname, delimiter, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { assertAlive, freePort, readFixtureManifest, spawnManaged, stopManaged, waitManaged, waitUntil } from './e2e-lifecycle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(process.env.E2E_BACKEND_DIR || join(root, '..', 'upc-pre-202620-1ASI0657-15987-FidiaCorp-backend'))
const temporary = await mkdtemp(join(tmpdir(), 'fidiacorp-e2e-'))
await chmod(temporary, 0o700)
const abort = new AbortController()
const interrupt = () => abort.abort()
process.once('SIGINT', interrupt)
process.once('SIGTERM', interrupt)
const children = []
function checkInterrupted() { if (abort.signal.aborted) throw new Error('Ejecución interrumpida.') }
let log
let failed = false
try {
  console.log('E2E: compilando el fixture de pruebas H2 local.')
  const classpathFile = join(temporary, 'classpath.txt')
  checkInterrupted()
  const maven = spawnManaged(process.platform === 'win32' ? 'mvn.cmd' : 'mvn', ['-q', '-DskipTests', 'test-compile', 'dependency:build-classpath', `-Dmdep.outputFile=${classpathFile}`], { cwd: backend, stdio: 'inherit' })
  children.push(maven)
  await waitManaged(maven, { signal: abort.signal })
  const classpath = [join(backend, 'target', 'test-classes'), join(backend, 'target', 'classes'), (await readFile(classpathFile, 'utf8')).trim()].join(delimiter)
  log = await open(join(temporary, 'backend.log'), 'wx', 0o600)
  const manifestPath = join(temporary, 'fixture.json')
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'
  checkInterrupted()
  const fixture = spawnManaged(java, ['-cp', classpath, 'com.fidiacorp.credicasa.testing.BrowserFixtureServer', manifestPath], { cwd: backend, stdio: ['ignore', log.fd, log.fd] })
  children.push(fixture)
  const manifest = await waitUntil(() => readFixtureManifest(manifestPath, fixture.pid), { signal: abort.signal, children: [[fixture, 'El fixture H2']] })
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  console.log('E2E: fixture H2 listo; iniciando Vite en un puerto local aleatorio.')
  checkInterrupted()
  const vite = spawnManaged(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_BASE_URL: manifest.apiBaseUrl }, stdio: 'ignore' })
  children.push(vite)
  await waitUntil(async () => {
    try { return (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(1000) })).ok } catch { return false }
  }, { signal: abort.signal, children: [[fixture, 'El fixture H2'], [vite, 'Vite']] })
  assertAlive(fixture, 'El fixture H2')
  checkInterrupted()
  const runner = spawnManaged(process.execPath, [join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)], { cwd: root, env: { ...process.env, E2E_FIXTURE_MANIFEST: manifestPath, E2E_BASE_URL: baseURL }, stdio: 'inherit' })
  children.push(runner)
  console.log('E2E: ejecutando Chrome contra la API real; no se muestran credenciales del fixture.')
  await waitManaged(runner, { signal: abort.signal, timeoutMs: 600000 })
} catch (error) {
  failed = true
  process.exitCode = abort.signal.aborted ? 130 : 1
  console.error(`E2E: ${error.message}`)
} finally {
  for (const child of [...children].reverse()) {
    try { await stopManaged(child) } catch { failed = true; process.exitCode ||= 1; console.error('E2E: no se pudo detener un proceso dedicado; se continúa con la limpieza restante.') }
  }
  try { await log?.close() } catch { process.exitCode ||= 1 }
  if (failed) {
    try {
      await mkdir(join(root, 'test-results'), { recursive: true })
      await copyFile(join(temporary, 'backend.log'), join(root, 'test-results', 'backend-fixture.log'))
      await chmod(join(root, 'test-results', 'backend-fixture.log'), 0o600)
    } catch { /* Diagnostics must never prevent removing the private manifest. */ }
  }
  try { await rm(temporary, { recursive: true, force: true }) } catch { process.exitCode ||= 1; console.error('E2E: no se pudo eliminar el directorio temporal privado.') }
  process.removeListener('SIGINT', interrupt)
  process.removeListener('SIGTERM', interrupt)
  console.log('E2E: procesos dedicados detenidos y manifiesto privado eliminado.')
}
