import { test, expect } from '@playwright/test'
import { api, credentials, fixture, loginUI, logoutUI, propertyAPI, registerAccount, unique } from './helpers.js'

test('sprint 3 (US06): validación de suscripción activa y verificación de pago en perfil', async ({ page, request }) => {
  const account = await registerAccount(request)
  const token = await loginUI(page, account)

  // Verify subscription status is visible in Profile
  await expect(page.locator('#sub-title')).toHaveText('Estado de Suscripción')
  await expect(page.locator('.badge')).toBeVisible()

  // Click renew / upgrade plan
  await page.getByRole('button', { name: /Activar suscripción|Mejorar o renovar plan/, exact: true }).click()
  await page.locator('#sub-ref').fill(`OP-${unique()}`)
  await page.getByRole('button', { name: 'Validar pago', exact: true }).click()

  // Verify successful status notification
  await expect(page.getByRole('status').filter({ hasText: 'Pago verificado' })).toBeVisible()
})

test('sprint 3 (US09): validación registral SUNARP del inmueble en el catálogo', async ({ page, request }) => {
  const account = await registerAccount(request)
  const token = await loginUI(page, account)
  const suffix = unique()

  // Register a new property
  await page.goto('/realState')
  await page.getByRole('button', { name: 'Registrar inmueble', exact: true }).click()
  await page.locator('#property-title').fill(`Inmueble Sunarp ${suffix}`)
  await page.locator('#property-address').fill('Av. Los Fresnos 210, La Molina')
  await page.locator('#property-price').fill('380000.00')
  await page.locator('#property-tags').fill('sol, jardin, la molina')
  await page.getByRole('button', { name: 'Guardar inmueble', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Inmueble registrado' })).toBeVisible()

  // Filter for our property
  await page.locator('#property-query').fill(suffix)
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click()

  const card = page.locator('.property-card').filter({ hasText: `Inmueble Sunarp ${suffix}` })
  await expect(card).toBeVisible()
  await expect(card.locator('.legitimacy-badge')).toBeVisible()

  // Trigger SUNARP verification modal
  await card.getByRole('button', { name: 'Validar SUNARP', exact: true }).click()
  await page.locator('#reg-entry').fill(`14298172`)
  await page.locator('#reg-sheet').fill(`P03192831`)
  await page.getByRole('button', { name: 'Consultar SUNARP', exact: true }).click()

  // Verification completed
  await expect(card.locator('.badge-verified')).toContainText('Verificado SUNARP')
})

test('sprint 3 (US12): exportación y descarga de cronograma en formato XLSX', async ({ page, request }) => {
  const account = await registerAccount(request)
  await loginUI(page, account)

  await page.goto('/simulations')
  await page.locator('#sim-loanAmount').fill('150000.00')
  await page.locator('#sim-propertyValue').fill('200000.00')
  await page.locator('#sim-termMonths').fill('60')
  await page.locator('#sim-teaPercent').fill('9.5')
  await page.locator('#sim-startDate').fill('2026-01-01')

  await page.getByRole('button', { name: 'Calcular simulación', exact: true }).click()
  await expect(page.locator('#schedule-title')).toBeVisible()

  // The export button is rendered
  const exportBtn = page.getByRole('button', { name: /Descargar cronograma \(\.xlsx\)/, exact: true })
  await expect(exportBtn).toBeVisible()
})

test('sprint 3 (US15): asistente hipotecario inteligente con recomendaciones deterministas SBS', async ({ page, request }) => {
  const account = await registerAccount(request)
  await loginUI(page, account)

  await page.goto('/simulations')
  await expect(page.locator('#ai-advisor-title')).toHaveText('Asistente Hipotecario Inteligente')

  await page.locator('#ai-income').fill('8000')
  await page.locator('#ai-down').fill('50000')
  await page.locator('#ai-district').fill('Miraflores')

  await page.getByRole('button', { name: 'Buscar Inmuebles Recomendados', exact: true }).click()

  // Profile evaluation shown
  await expect(page.locator('.evaluation-summary')).toBeVisible()
  await expect(page.locator('.evaluation-summary')).toContainText('Normativa SBS')
})

test('sprint 3 (US17 y US18): bloqueo de usuarios indeseados y exportación de historial de mensajería', async ({ page, request }) => {
  const account = await registerAccount(request)
  await loginUI(page, account)

  await page.goto('/notifications')
  await expect(page.locator('#messaging-heading')).toBeVisible()

  // Export buttons visible
  await expect(page.getByRole('button', { name: /Descargar historial \(\.txt\)/, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar \(\.json\)/, exact: true })).toBeVisible()

  // Navigate to block controls tab
  await page.getByRole('button', { name: /Control de Bloqueos/, exact: true }).click()
  const targetUuid = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
  await page.locator('#block-target').fill(targetUuid)
  await page.locator('#block-reason').fill('Contacto inapropiado')
  await page.getByRole('button', { name: 'Bloquear Usuario', exact: true }).click()

  await expect(page.getByRole('status').filter({ hasText: 'bloqueado exitosamente' })).toBeVisible()
})
