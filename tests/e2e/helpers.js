import { randomUUID, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test as base, expect } from '@playwright/test'

export const fixture = JSON.parse(readFileSync(process.env.E2E_FIXTURE_MANIFEST, 'utf8'))
export const unique = () => randomUUID().replaceAll('-', '')
export const credentials = () => ({ firstName: 'Prueba', lastName: 'Integrada', email: `e2e-${unique()}@example.com`, password: `E2e-${unique()}!` })
// Inmuebles temporales creados durante el test en curso (por API o por la UI) con el token de su propietario.
// Al terminar cada test se eliminan con DELETE /properties/{id} (soft-delete real) para no ensuciar el catálogo.
const temporaryProperties = new Map()
const pendingCaptures = new Set()
export function trackProperty(id, token) {
  if (typeof id === 'string' && id && typeof token === 'string' && token) temporaryProperties.set(id, token)
}
export async function cleanupProperties(request) {
  await Promise.allSettled([...pendingCaptures])
  const pending = [...temporaryProperties]
  temporaryProperties.clear()
  const leftovers = []
  for (const [id, token] of pending) {
    const response = await request.delete(`${fixture.apiBaseUrl}/properties/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    // 204: eliminado ahora; 404: el propio test ya lo había eliminado.
    if (![204, 404].includes(response.status())) leftovers.push(`${id} (HTTP ${response.status()})`)
  }
  return leftovers
}
// Registra los POST /properties que hace la SPA (alta desde /realState) con el token Bearer de esa petición.
function captureUiProperty(response) {
  const request = response.request()
  if (request.method() !== 'POST' || response.status() !== 201 || !/\/api\/v1\/properties$/.test(new URL(response.url()).pathname)) return
  const capture = (async () => {
    const token = (await request.headerValue('authorization'))?.replace(/^Bearer\s+/i, '')
    const created = await response.json()
    trackProperty(created?.id, token)
  })().catch(() => { /* Sin cuerpo legible: el test lo elimina por su cuenta o queda en el informe. */ })
  pendingCaptures.add(capture)
  capture.finally(() => pendingCaptures.delete(capture))
}
export const test = base.extend({
  context: async ({ context }, use) => {
    context.on('response', captureUiProperty)
    await use(context)
  },
  temporaryPropertyCleanup: [async ({ request }, use) => {
    await use()
    const leftovers = await cleanupProperties(request)
    expect(leftovers, 'Inmuebles temporales que no se pudieron eliminar al terminar el test').toEqual([])
  }, { auto: true }],
})
export async function api(request, method, path, { token, body, status = 200 } = {}) {
  const response = await request[method](`${fixture.apiBaseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, ...(body !== undefined ? { data: body } : {}) })
  expect(response.status(), `API ${method.toUpperCase()} ${path}`).toBe(status)
  if (status === 204) return null
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (method === 'post' && path === '/properties' && status === 201) trackProperty(parsed?.id, token)
  return parsed
}
export async function registerAccount(request) {
  const account = credentials()
  const profile = await api(request, 'post', '/auth/register', { body: account, status: 201 })
  return { ...account, id: profile.id }
}
export const loginAPI = (request, account) => api(request, 'post', '/auth/login', { body: { email: account.email, password: account.password } })
export async function loginUI(page, account) {
  await page.goto('/login')
  await page.locator('#email').fill(account.email)
  await page.locator('#password').fill(account.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.locator('#firstName')).toHaveValue(account.firstName || 'Prueba')
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('fidiacorp.session')).token)
}
export async function logoutUI(page) {
  await page.locator('header').getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/login\?loggedOut=1$/)
  await expect(page.getByRole('status').filter({ hasText: 'La sesión anterior ya no permite acceso' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('fidiacorp.session'))).toBeNull()
}
export async function propertyAPI(request, token, suffix = unique()) {
  return api(request, 'post', '/properties', { token, status: 201, body: { title: `Inmueble ${suffix}`, address: 'Lima, dirección de prueba', description: 'Creado exclusivamente para aceptación local', price: '250000.00', currency: 'PEN', tags: [`suite-${suffix}`, 'terraza', 'estacionamiento'] } })
}
export async function issueOffer(request, token, propertyId, recipientEmail, overrides = {}) {
  return api(request, 'post', '/offers', { token, status: 201, body: { recipientEmail, propertyId, bankCode: 'BCP', loanAmount: '200000.00', currency: 'PEN', annualInterestRate: '0.085', termMonths: 240, startDate: '2024-01-31', ...overrides } })
}
export function otpFor(secret, milliseconds = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const character of secret.toUpperCase().replace(/=+$/, '')) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error('La clave TOTP de prueba no es Base32.')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset, offset + 8), 2))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(milliseconds / 30000)))
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const offset = hash.at(-1) & 15
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
export async function nextOtpStep() {
  await new Promise(resolve => setTimeout(resolve, 30000 - (Date.now() % 30000) + 500))
}
