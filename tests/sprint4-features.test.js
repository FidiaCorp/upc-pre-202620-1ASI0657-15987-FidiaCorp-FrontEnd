import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describeRateTerms, ratePayload, requireCompleteSchedule, simulationDefaults, simulationPayload, validateSimulation } from '../src/simulations/model.js'
import { compareScenarios, comparisonCriteria, comparisonPayload, listSimulations, requireComparison, requireSimulationPage, scenarioDefaults, validateScenarios, winsByLabel } from '../src/simulations/scenarios.js'
import { createVersion, downloadVersionExport, exportFileName, isRealtor, listExports, listVersions, requireExports, requireVersion, requireVersions, shortHash, verifyVersion, versionPayload, versionStatus } from '../src/offers/versions.js'
import { clearSession, session, sessionRoles, startSession } from '../src/account/session.js'

/**
 * Sprint 4 (Etapa 2). Contratos REALES:
 *  - tests/contracts/sprint4-contracts.json: respuestas capturadas del stack docker compose a través del API Gateway :8080.
 *  - tests/contracts/openapi-v2-gateway.json: OpenAPI generado por springdoc en los 5 microservicios y fusionado.
 */
const contracts = JSON.parse(readFileSync(new URL('./contracts/sprint4-contracts.json', import.meta.url), 'utf8'))
const openapi = JSON.parse(readFileSync(new URL('./contracts/openapi-v2-gateway.json', import.meta.url), 'utf8'))
const schema = name => openapi.components.schemas[name]
const operation = (path, method) => openapi.paths[`/api/v1${path}`]?.[method]
const form = () => ({ ...simulationDefaults(), loanAmount: '100000.00', termMonths: '12', teaPercent: '12', startDate: '2026-01-31' })

async function withFetch(handler, run) {
  const previous = globalThis.fetch
  const calls = []
  startSession({ token: 'sprint4-token', expiresIn: 60000 })
  globalThis.fetch = async (url, options = {}) => { calls.push({ url, options }); return handler(url, options) }
  try { await run(calls) } finally { globalThis.fetch = previous; clearSession() }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('US19: el payload TEA/TNA coincide con SimulationRequestDto real y la TNA exige capitalización 1..365', () => {
  const properties = schema('SimulationRequestDto').properties
  assert.ok(properties.rateType && properties.compoundingPeriodsPerYear)
  const tea = simulationPayload(form())
  assert.equal(tea.rateType, 'TEA')
  assert.equal('compoundingPeriodsPerYear' in tea, false)
  assert.equal(tea.annualInterestRate, '0.12')
  const tna = simulationPayload({ ...form(), rateType: 'TNA', compoundingPeriodsPerYear: '360' })
  assert.deepEqual({ rateType: tna.rateType, compoundingPeriodsPerYear: tna.compoundingPeriodsPerYear, annualInterestRate: tna.annualInterestRate }, { rateType: 'TNA', compoundingPeriodsPerYear: 360, annualInterestRate: '0.12' })
  for (const key of Object.keys(tna)) assert.ok(key in properties, `campo ${key} no existe en el contrato`)
  assert.deepEqual(ratePayload({ rateType: 'otro' }), { rateType: 'TEA' })
  assert.deepEqual(validateSimulation({ ...form(), rateType: 'TNA', compoundingPeriodsPerYear: '12' }), {})
  for (const bad of ['0', '366', '', '1.5', 'x']) assert.ok(validateSimulation({ ...form(), rateType: 'TNA', compoundingPeriodsPerYear: bad }).compoundingPeriodsPerYear, bad)
  assert.match(validateSimulation({ ...form(), rateType: 'TNA', teaPercent: '0' }).teaPercent, /TNA/)
  assert.ok(validateSimulation({ ...form(), rateType: 'XYZ' }).rateType)
})

test('US19: la respuesta real de una TNA diaria se acepta y describe la TEA equivalente 12.747431 %', () => {
  const real = contracts.simulationTna
  assert.equal(real.status, 201)
  assert.equal(requireCompleteSchedule(real.response).schedule.length, 12)
  assert.deepEqual(describeRateTerms(real.response.rate), { type: 'TNA', input: '0.12', periods: 360, effective: '0.12747431' })
  assert.equal(real.response.metrics.tea, '0.12747431')
  assert.equal(describeRateTerms({ rateType: 'TEA', inputRate: '0.095', effectiveAnnualRate: '0.09500000' }).periods, null)
  assert.equal(describeRateTerms(null), null)
  assert.equal(describeRateTerms({ rateType: 'TNA', effectiveAnnualRate: 0.1 }), null)
  assert.equal(contracts.simulationTnaMissingPeriods.status, 400)
  assert.match(contracts.simulationTnaMissingPeriods.response.message, /compoundingPeriodsPerYear/)
})

test('US20: historial paginado real (más recientes primero) y cliente GET /simulations', async () => {
  const page = requireSimulationPage(contracts.simulationPage.response)
  assert.deepEqual(page.items.map(item => item.rateType), ['TEA', 'TNA'])
  assert.equal(page.items[1].tea, '0.12747431')
  assert.ok(operation('/simulations', 'get'))
  assert.throws(() => requireSimulationPage({ items: [{ quotationId: 'x', currency: 'PEN', loanAmount: 1 }], page: 0, totalPages: 1, totalElements: 1 }), /historial/)
  assert.throws(() => requireSimulationPage(null), /historial/)
  await withFetch(() => json(contracts.simulationPage.response), async calls => {
    const value = await listSimulations({ page: 2, size: 5 })
    assert.equal(value.items.length, 2)
    assert.ok(calls[0].url.endsWith('/simulations?page=2&size=5'))
    assert.equal(calls[0].options.headers.Authorization, 'Bearer sprint4-token')
  })
})

test('US20: validación del comparador (2–3 escenarios, etiquetas únicas, prepago acotado) y payload del contrato', () => {
  const common = { currency: 'PEN', propertyValue: '', startDate: '2026-01-31', discountPercent: '' }
  const a = { ...scenarioDefaults(0), loanAmount: '200000.00', teaPercent: '9.5' }
  const b = { ...scenarioDefaults(1), loanAmount: '200000.00', rateType: 'TNA', compoundingPeriodsPerYear: '12', teaPercent: '9' }
  assert.equal(validateScenarios(common, [a, b]).valid, true)
  assert.equal(validateScenarios(common, [a]).general, 'Compara entre 2 y 3 escenarios.')
  assert.match(validateScenarios(common, [a, { ...b, label: ' escenario a ' }]).scenarios[1].label, /distinta/)
  const prepaid = { ...a, label: 'Con prepago', prepayment: true, afterInstallment: '240', prepaymentAmount: '200000.00', strategy: 'NONE' }
  const errors = validateScenarios(common, [a, b, prepaid]).scenarios[2]
  assert.ok(errors.afterInstallment && errors.prepaymentAmount && errors.strategy)
  assert.ok(validateScenarios({ ...common, startDate: '2026-02-30' }, [a, b]).common.startDate)
  const body = comparisonPayload(common, [a, b, { ...a, label: 'Con prepago', prepayment: true, afterInstallment: '24', prepaymentAmount: '20000.00', strategy: 'REDUCE_TERM' }])
  assert.equal(body.scenarios.length, 3)
  assert.deepEqual(body.scenarios[2].extraordinaryPayment, { afterInstallment: 24, amount: '20000.00', strategy: 'REDUCE_TERM' })
  assert.equal('extraordinaryPayment' in body.scenarios[0], false)
  assert.equal(body.scenarios[1].simulation.compoundingPeriodsPerYear, 12)
  for (const key of Object.keys(body.scenarios[2])) assert.ok(key in schema('ScenarioRequest').properties, key)
  for (const key of Object.keys(body.scenarios[2].extraordinaryPayment)) assert.ok(key in schema('ExtraordinaryPaymentRequest').properties, key)
  assert.deepEqual(schema('ExtraordinaryPaymentRequest').properties.strategy.enum, ['REDUCE_TERM', 'REDUCE_INSTALLMENT'])
})

test('US20: la comparación real se valida, se resaltan los ganadores y POST /simulations/compare propaga errores 400', async () => {
  const real = contracts.comparison.response
  assert.equal(requireComparison(structuredClone({ ...real, scenarios: real.scenarios.map(s => ({ ...s, schedule: Array.from({ length: s.effectiveTermMonths }, () => ({})) })) }), 3).scenarios.length, 3)
  const wins = winsByLabel(real)
  assert.equal(Object.values(wins).flat().length, comparisonCriteria.length)
  assert.equal(real.scenarios[1].rate.effectiveAnnualRate, '0.09380690')
  assert.ok(real.scenarios[2].effectiveTermMonths < real.scenarios[2].termMonths)
  assert.throws(() => requireComparison(real, 2), /incompleta/)
  assert.throws(() => requireComparison({ ...real, bestByTcea: 'Otro' }, 3), /incompleta/)
  await withFetch(() => json(contracts.comparisonTooFew.response, 400), async () => {
    await assert.rejects(compareScenarios({ scenarios: [{}] }), error => error.status === 400)
  })
})

test('US21: versiones reales inmutables (SHA-256), estado de integridad/vigencia y orden descendente', () => {
  const versions = requireVersions(contracts.versionList.response)
  assert.deepEqual(versions.map(version => version.versionNumber), [2, 1])
  assert.notEqual(versions[0].snapshotHash, versions[1].snapshotHash)
  assert.deepEqual(versionStatus(versions[0]), { label: 'Íntegra · vigente', tone: 'ok' })
  assert.equal(versionStatus({ ...versions[0], expired: true }).label, 'Íntegra · vencida')
  assert.equal(versionStatus({ ...versions[0], intact: false }).tone, 'danger')
  assert.equal(requireVersion(contracts.versionVerify.response).intact, true)
  assert.equal(contracts.versionCreated.status, 201)
  assert.equal(contracts.versionForbiddenForClient.status, 403)
  assert.throws(() => requireVersion({ ...versions[0], snapshotHash: 'abc' }), /inválida/)
  assert.throws(() => requireVersions([versions[0], versions[0]]), /duplicadas/)
  assert.throws(() => requireVersions({}), /historial/)
  assert.equal(shortHash(versions[0].snapshotHash).length, 17)
  assert.equal(shortHash(null), '—')
  for (const key of ['id', 'versionNumber', 'snapshotHash', 'intact', 'expired', 'expiresAt']) assert.ok(key in schema('QuotationVersionResponse').properties, key)
})

test('US21: nueva versión solo con campos informados, conversión exacta de TEA y control por rol', async () => {
  assert.deepEqual(versionPayload({ loanAmount: '', ratePercent: '7.99', termMonths: '', validityDays: '10' }), { body: { annualInterestRate: '0.0799', validityDays: 10 }, errors: {} })
  assert.deepEqual(versionPayload({ loanAmount: '190000.00', ratePercent: '', termMonths: '240', validityDays: '' }).body, { loanAmount: '190000.00', termMonths: 240 })
  const invalid = versionPayload({ loanAmount: '0', ratePercent: '101', termMonths: '361', validityDays: '91' }).errors
  assert.deepEqual(Object.keys(invalid).sort(), ['loanAmount', 'ratePercent', 'termMonths', 'validityDays'])
  for (const key of ['loanAmount', 'annualInterestRate', 'termMonths', 'validityDays']) assert.ok(key in schema('CreateQuotationVersionRequest').properties, key)
  assert.equal(isRealtor({ roles: ['ROLE_CLIENT', 'ROLE_REALTOR'] }), true)
  assert.equal(isRealtor({ roles: ['ROLE_CLIENT'] }), false)
  assert.equal(isRealtor(null), false)
  await withFetch((url, options) => json(options.method === 'POST' ? contracts.versionCreated.response : url.includes('/verify') ? contracts.versionVerify.response : contracts.versionList.response, options.method === 'POST' ? 201 : 200), async calls => {
    assert.equal((await createVersion('offer/1', { termMonths: 12 })).versionNumber, 2)
    assert.equal(JSON.parse(calls[0].options.body).termMonths, 12)
    assert.ok(calls[0].url.endsWith('/offers/offer%2F1/versions'))
    assert.equal((await listVersions('o')).length, 2)
    assert.equal((await verifyVersion(contracts.versionVerify.response.id)).intact, true)
    assert.ok(calls[2].url.endsWith(`/quotations/versions/${contracts.versionVerify.response.id}/verify`))
  })
})

test('US22: exportación PDF por versión (nombre, query y cabeceras reales) e historial de exportaciones', async () => {
  const headers = contracts.pdfExportHeaders.response
  assert.equal(headers['content-type'], 'application/pdf')
  assert.equal(headers['x-quotation-version'], '1')
  assert.match(headers['x-snapshot-sha256'], /^[0-9a-f]{64}$/)
  assert.match(headers['content-disposition'], /cotizacion_oferta_.+_v1\.pdf/)
  assert.ok(operation('/offers/{offerId}/schedule/export/pdf', 'get'))
  assert.ok(operation('/offers/{offerId}/exports', 'get'))
  assert.equal(exportFileName('o-1', 'pdf', 1), 'cotizacion_oferta_o-1_v1.pdf')
  assert.equal(exportFileName('o-1', 'pdf'), 'cotizacion_oferta_o-1.pdf')
  const jobs = requireExports(contracts.exportJobs.response)
  assert.ok(jobs.some(job => job.format === 'PDF' && job.status === 'COMPLETED' && job.versionNumber === 1 && /^[0-9a-f]{64}$/.test(job.contentSha256)))
  assert.throws(() => requireExports([{ id: 'x', format: 'DOCX', status: 'COMPLETED', versionNumber: 1 }]), /exportaciones/)
  assert.throws(() => downloadVersionExport('o', 'docx'), /no soportado/)
  await withFetch(url => url.includes('/exports') ? json(contracts.exportJobs.response) : new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers: { 'Content-Type': 'application/pdf' } }), async calls => {
    const blob = await downloadVersionExport('offer-1', 'pdf', 2)
    assert.equal(blob.size, 4)
    assert.ok(calls[0].url.endsWith('/offers/offer-1/schedule/export/pdf?version=2'))
    assert.equal(calls[0].options.headers.Authorization, 'Bearer sprint4-token')
    assert.equal((await listExports('offer-1')).length, jobs.length)
  })
})

test('US22: un snapshot alterado (409 ProblemDetail) muestra el mensaje del servidor; 5xx usa un mensaje genérico', async () => {
  const problem = { status: 409, message: 'El snapshot de la versión 1 no supera la verificación SHA-256.', code: 'CONFLICT' }
  await withFetch(() => json(problem, 409), async () => {
    await assert.rejects(downloadVersionExport('o', 'pdf', 1), error => error.status === 409 && /SHA-256/.test(error.message))
  })
  await withFetch(() => json({ message: 'detalle interno' }, 503), async () => {
    await assert.rejects(downloadVersionExport('o', 'xlsx'), error => error.status === 503 && !/detalle interno/.test(error.message))
  })
})

test('roles de sesión: se leen de la respuesta de login o, tras recargar, del claim "roles" del JWT', () => {
  const payload = Buffer.from(JSON.stringify({ sub: 'u', roles: ['ROLE_CLIENT', 'ROLE_REALTOR'] })).toString('base64url')
  try {
    startSession({ token: `h.${payload}.s`, expiresIn: 60000, roles: ['ROLE_CLIENT'] })
    assert.deepEqual(sessionRoles(), ['ROLE_CLIENT'])
    session.user = null
    assert.deepEqual(sessionRoles(), ['ROLE_CLIENT', 'ROLE_REALTOR'])
    session.token = 'not-a-jwt'
    assert.deepEqual(sessionRoles(), [])
  } finally { clearSession() }
  assert.deepEqual(sessionRoles(), [])
})

test('contrato v2: el gateway publica las 42 rutas (50 operaciones) de los 5 microservicios sin rutas internas', () => {
  const paths = Object.keys(openapi.paths)
  assert.equal(paths.length, 42)
  assert.equal(paths.some(path => path.includes('/internal/')), false)
  for (const path of ['/simulations', '/simulations/compare', '/offers/{offerId}/versions', '/quotations/versions/{versionId}/verify', '/offers/{offerId}/exports']) assert.ok(paths.includes(`/api/v1${path}`), path)
})
