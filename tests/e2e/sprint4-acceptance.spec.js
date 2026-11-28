import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { api, fixture, issueOffer, loginAPI, loginUI, propertyAPI, registerAccount, test } from './helpers.js'

// Sprint 4 (Etapa 2): sin mocks; cada paso llega a mortgage-pricing-service y quotation-deal-service vía API Gateway :8080.
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] // %PDF

async function downloadBytes(page, trigger) {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()])
  const bytes = await readFile(await download.path())
  return { bytes, name: download.suggestedFilename() }
}
async function raw(request, path, token) {
  const response = await request.get(`${fixture.apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return { status: response.status(), headers: response.headers(), bytes: await response.body() }
}

test('sprint 4 (US19 + US20): TNA con capitalización diaria convertida a TEA y historial de simulaciones propias', async ({ page, request }) => {
  const account = await registerAccount(request)
  const token = await loginUI(page, account)
  await page.goto('/simulations')
  await expect(page.locator('.simulation-history')).toContainText('Aún no tienes simulaciones guardadas')
  await page.locator('#sim-rateType').selectOption('TNA')
  await expect(page.locator('label[for="sim-teaPercent"]')).toHaveText('TNA anual (%)')
  await page.locator('#sim-compounding').selectOption('360')
  await page.locator('#sim-loanAmount').fill('100000.00')
  await page.locator('#sim-termMonths').fill('12')
  await page.locator('#sim-teaPercent').fill('12')
  await page.locator('#sim-startDate').fill('2026-01-31')
  await page.getByRole('button', { name: 'Calcular simulación', exact: true }).click()
  await expect(page.locator('.schedule-table tbody tr')).toHaveCount(12)
  await expect(page.locator('.rate-input')).toContainText('TNA 12 %')
  await expect(page.locator('.rate-input')).toContainText('capitalización 360/año')
  await expect(page.locator('.rate-effective')).toHaveText('12.747431 %')
  const tnaId = await page.locator('.quotation-id').innerText()
  const saved = await api(request, 'get', `/simulations/${tnaId}`, { token })
  expect(saved.rate).toEqual({ rateType: 'TNA', inputRate: '0.12', compoundingPeriodsPerYear: 360, effectiveAnnualRate: '0.12747431' })
  // El historial expone la misma representación que el cálculo (sin la escala de las columnas NUMERIC).
  expect(saved.metrics.tea).toBe('0.12747431')

  // TNA sin capitalización: el contrato exige compoundingPeriodsPerYear → 400 (no se adivina).
  await api(request, 'post', '/simulations/calculate', { token, status: 400, body: { loanAmount: '1000.00', currency: 'PEN', termMonths: 12, annualInterestRate: '0.12', rateType: 'TNA', startDate: '2026-01-31' } })
  const tea = await api(request, 'post', '/simulations/calculate', { token, status: 201, body: { loanAmount: '50000.00', currency: 'USD', termMonths: 24, annualInterestRate: '0.095', rateType: 'TEA', startDate: '2026-01-31' } })
  expect(tea.rate).toEqual({ rateType: 'TEA', inputRate: '0.095', compoundingPeriodsPerYear: null, effectiveAnnualRate: '0.09500000' })
  expect((await api(request, 'get', `/simulations/${tea.quotationId}`, { token })).rate).toEqual(tea.rate)

  await page.reload()
  const rows = page.locator('.simulation-history tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toHaveAttribute('data-id', tea.quotationId)
  await expect(rows.nth(1)).toContainText('TNA 12 %')
  await rows.nth(1).getByRole('button', { name: 'Ver cronograma', exact: true }).click()
  await expect(page.locator('.quotation-id')).toHaveText(tnaId)
  const history = await api(request, 'get', '/simulations?page=0&size=10', { token })
  expect(history.totalElements).toBe(2)
  expect(history.items.map(item => item.quotationId)).toEqual([tea.quotationId, tnaId])
  expect(history.items[1]).toMatchObject({ rateType: 'TNA', inputRate: '0.12', tea: '0.12747431' })
  const intruder = await loginAPI(request, fixture.otherClient)
  expect((await api(request, 'get', '/simulations', { token: intruder.token })).items.some(item => [tnaId, tea.quotationId].includes(item.quotationId))).toBe(false)
})

test('sprint 4 (US20): comparador de 3 escenarios con TNA y prepago extraordinario, igual que el contrato real', async ({ page, request }) => {
  const account = await registerAccount(request)
  const token = await loginUI(page, account)
  await page.goto('/simulations')
  await page.getByRole('link', { name: 'Comparar escenarios (US20)', exact: true }).click()
  await expect(page).toHaveURL(/\/simulations\/compare$/)
  await page.locator('#cmp-startDate').fill('2026-01-31')
  await page.locator('#cmp-0-label').fill('Banco A')
  await page.locator('#cmp-0-loanAmount').fill('200000.00')
  await page.locator('#cmp-0-termMonths').fill('240')
  await page.locator('#cmp-0-rate').fill('9.5')
  await page.locator('#cmp-1-label').fill('Banco A')
  await page.locator('#cmp-1-loanAmount').fill('200000.00')
  await page.locator('#cmp-1-termMonths').fill('240')
  await page.locator('#cmp-1-rateType').selectOption('TNA')
  await page.locator('#cmp-1-compounding').selectOption('12')
  await page.locator('#cmp-1-rate').fill('9')
  await page.getByRole('button', { name: 'Comparar escenarios', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Revisa los campos indicados')
  await expect(page.locator('.scenario-card[data-index="1"]')).toContainText('Cada escenario necesita una etiqueta distinta')
  await page.locator('#cmp-1-label').fill('Banco B (TNA)')
  await page.getByRole('button', { name: 'Añadir escenario', exact: true }).click()
  await page.locator('#cmp-2-label').fill('Banco A + prepago')
  await page.locator('#cmp-2-loanAmount').fill('200000.00')
  await page.locator('#cmp-2-termMonths').fill('240')
  await page.locator('#cmp-2-rate').fill('9.5')
  await page.locator('#cmp-2-prepayment').check()
  await page.locator('#cmp-2-after').fill('24')
  await page.locator('#cmp-2-amount').fill('20000.00')
  await page.locator('#cmp-2-strategy').selectOption('REDUCE_TERM')
  await page.getByRole('button', { name: 'Comparar escenarios', exact: true }).click()
  const table = page.locator('.comparison-table')
  await expect(table.locator('thead th')).toHaveCount(4)

  const simulation = (rate, extra = {}) => ({ loanAmount: '200000.00', currency: 'PEN', termMonths: 240, annualInterestRate: rate, startDate: '2026-01-31', propertyAddress: '', gracePeriodType: 'NONE', gracePeriodMonths: 0, balloonPaymentAmount: '0', lifeInsuranceRate: '0', propertyInsuranceRate: '0', monthlyAdminFee: '0', ...extra })
  const expected = await api(request, 'post', '/simulations/compare', { token, body: { scenarios: [
    { label: 'Banco A', simulation: simulation('0.095', { rateType: 'TEA' }) },
    { label: 'Banco B (TNA)', simulation: simulation('0.09', { rateType: 'TNA', compoundingPeriodsPerYear: 12 }) },
    { label: 'Banco A + prepago', simulation: simulation('0.095', { rateType: 'TEA' }), extraordinaryPayment: { afterInstallment: 24, amount: '20000.00', strategy: 'REDUCE_TERM' } },
  ] } })
  for (const key of ['bestByTcea', 'bestByTotalInterest', 'bestByMonthlyInstallment', 'bestByVan', 'bestByTotalCost']) {
    await expect(page.locator(`[data-criterion="${key}"] .best-label`)).toHaveText(expected[key])
  }
  const prepaid = expected.scenarios.find(scenario => scenario.label === 'Banco A + prepago')
  expect(prepaid.effectiveTermMonths).toBeLessThan(240)
  expect(Number(prepaid.interestSavings)).toBeGreaterThan(0)
  expect(prepaid.schedule.at(-1).finalBalance).toBe('0.00')
  expect(expected.scenarios[1].rate.effectiveAnnualRate).toBe('0.09380690')
  await expect(table.locator('.effective-term').nth(2)).toHaveText(`${prepaid.effectiveTermMonths} meses`)
  await expect(table.locator('[data-metric="tcea"] td').nth(1)).toContainText('%')
  // La comparación no se persiste en el historial (US20).
  expect((await api(request, 'get', '/simulations', { token })).totalElements).toBe(0)
  await api(request, 'post', '/simulations/compare', { token, status: 400, body: { scenarios: [{ label: 'Solo uno', simulation: simulation('0.095') }] } })
})

test('sprint 4 (US21 + US22): versiones inmutables con SHA-256, verificación e historial; PDF por versión y exportaciones', async ({ page, request, browser }) => {
  const account = await registerAccount(request)
  const advisor = await loginAPI(request, fixture.realtor)
  const property = await propertyAPI(request, advisor.token)
  const offer = await issueOffer(request, advisor.token, property.id, account.email, { termMonths: 36 })
  const v2 = await api(request, 'post', `/offers/${offer.id}/versions`, { token: advisor.token, status: 201, body: { annualInterestRate: '0.0799', validityDays: 10 } })
  expect(v2.versionNumber).toBe(2)
  expect(v2.snapshotHash).toMatch(/^[0-9a-f]{64}$/)
  expect(v2.annualInterestRate).toBe('0.07990000')

  const token = await loginUI(page, account)
  await api(request, 'post', `/offers/${offer.id}/versions`, { token, status: 403, body: { termMonths: 12 } })
  await page.goto(`/offers/${offer.id}`)
  const versions = page.locator('.version-item')
  await expect(versions).toHaveCount(2)
  await expect(versions.first()).toHaveAttribute('data-version', '2')
  await expect(versions.first().locator('.version-status')).toHaveText('Íntegra · vigente')
  await expect(versions.first()).toContainText('7.99 %')
  const listed = await api(request, 'get', `/offers/${offer.id}/versions`, { token })
  const v1 = listed.find(version => version.versionNumber === 1)
  expect(v1.snapshotHash).not.toBe(v2.snapshotHash)
  await expect(versions.nth(1).locator('.snapshot-hash')).toHaveAttribute('title', v1.snapshotHash)
  await versions.nth(1).getByRole('button', { name: 'Verificar integridad', exact: true }).click()
  await expect(versions.nth(1).locator('.verification-result')).toHaveText('Íntegra · vigente')
  expect((await api(request, 'get', `/quotations/versions/${v1.id}/verify`, { token })).intact).toBe(true)

  const pdf = await downloadBytes(page, () => versions.nth(1).getByRole('button', { name: 'Descargar PDF v1', exact: true }).click())
  expect([...pdf.bytes.subarray(0, 4)]).toEqual(PDF_SIGNATURE)
  expect(pdf.name).toBe(`cotizacion_oferta_${offer.id}_v1.pdf`)
  await expect(page.locator('.export-list li[data-format="PDF"]').first()).toContainText('PDF · v1 · Completada')
  const direct = await raw(request, `/offers/${offer.id}/schedule/export/pdf?version=1`, token)
  expect(direct.status).toBe(200)
  expect(direct.headers['content-type']).toContain('application/pdf')
  expect(direct.headers['x-snapshot-sha256']).toBe(v1.snapshotHash)
  expect(direct.headers['x-quotation-version']).toBe('1')
  const jobs = await api(request, 'get', `/offers/${offer.id}/exports`, { token })
  expect(jobs.filter(job => job.format === 'PDF' && job.status === 'COMPLETED' && job.versionNumber === 1).length).toBeGreaterThanOrEqual(2)

  await page.getByRole('button', { name: 'Generar o recuperar cronograma de oferta', exact: true }).click()
  await expect(page.locator('.schedule-table tbody tr')).toHaveCount(36)
  const latest = await downloadBytes(page, () => page.getByRole('button', { name: 'Exportar PDF', exact: true }).click())
  expect([...latest.bytes.subarray(0, 4)]).toEqual(PDF_SIGNATURE)
  expect(latest.name).toBe(`cotizacion_oferta_${offer.id}.pdf`)

  const intruder = await loginAPI(request, fixture.otherClient)
  await api(request, 'get', `/offers/${offer.id}/versions`, { token: intruder.token, status: 404 })
  expect((await raw(request, `/offers/${offer.id}/schedule/export/pdf`, intruder.token)).status).toBe(404)

  // Emisor: historial y nueva versión desde la interfaz (solo ROLE_REALTOR ve el formulario).
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    const advisorPage = await context.newPage()
    await loginUI(advisorPage, fixture.realtor)
    await advisorPage.goto(`/offers/${offer.id}/versions`)
    await expect(advisorPage.locator('.version-item')).toHaveCount(2)
    await advisorPage.locator('#ver-termMonths').fill('24')
    await advisorPage.getByRole('button', { name: 'Emitir versión', exact: true }).click()
    await expect(advisorPage.getByRole('status').filter({ hasText: 'Se emitió la versión 3.' })).toBeVisible()
    await expect(advisorPage.locator('.version-item').first()).toHaveAttribute('data-version', '3')
  } finally { await context.close() }
  const after = await api(request, 'get', `/offers/${offer.id}/versions`, { token })
  expect(after.map(version => version.versionNumber)).toEqual([3, 2, 1])
  expect(after.find(version => version.versionNumber === 1).snapshotHash).toBe(v1.snapshotHash)
})
