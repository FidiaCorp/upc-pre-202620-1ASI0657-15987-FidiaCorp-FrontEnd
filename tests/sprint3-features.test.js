import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clearSession, startSession } from '../src/account/session.js'
import { checkoutPayment, getSubscriptionStatus, listPaymentGateways, subscriptionSummary, verifyPayment } from '../src/subscriptions/api.js'
import { getPropertyLegitimacy, legitimacyBadge, verifyPropertyRegistry } from '../src/properties/api.js'
import { downloadOfferScheduleXlsx, downloadSimulationXlsx } from '../src/simulations/api.js'
import { advisorView, getAiPropertyRecommendations } from '../src/simulations/ai-api.js'
import {
  blockUser, exportConversationJson, exportConversationText, isUuid, listBlockedUsers, listConversations, listMessages,
  sendMessage, startConversation, threadView, unblockUser,
} from '../src/messaging/api.js'

/*
 * Contratos REALES: tests/contracts/sprint3-contracts.json se captura desde el backend Spring Boot
 * (FrontendContractFixturesTest) y openapi-v1.3.0.json es el documento /v3/api-docs generado por springdoc.
 * Los cuerpos que envía el frontend se validan contra los esquemas de request del OpenAPI y las respuestas
 * simuladas en fetch son exactamente las capturadas.
 */
const contracts = JSON.parse(readFileSync(new URL('./contracts/sprint3-contracts.json', import.meta.url), 'utf8'))
const openapi = JSON.parse(readFileSync(new URL('./contracts/openapi-v1.3.0.json', import.meta.url), 'utf8'))

function requestSchema(path, method) {
  const op = openapi.paths[`/api/v1${path}`]?.[method]
  assert.ok(op, `Operación ${method.toUpperCase()} ${path} ausente en el OpenAPI real`)
  const ref = op.requestBody?.content?.['application/json']?.schema?.$ref
  return ref ? openapi.components.schemas[ref.split('/').at(-1)] : null
}

/** Las claves enviadas deben existir en el DTO del backend y cubrir todos sus campos obligatorios. */
function assertMatchesRequestSchema(body, path, method = 'post') {
  const schema = requestSchema(path, method)
  assert.ok(schema, `Sin esquema de request para ${path}`)
  const allowed = Object.keys(schema.properties)
  for (const key of Object.keys(body)) assert.ok(allowed.includes(key), `${path}: el campo "${key}" no existe en el DTO real (${allowed.join(', ')})`)
  for (const key of schema.required || []) assert.ok(body[key] !== undefined && body[key] !== null, `${path}: falta el campo obligatorio "${key}"`)
}

function respond(name) {
  const entry = contracts[name]
  assert.ok(entry, `Captura real "${name}" inexistente`)
  return new Response(JSON.stringify(entry.response), { status: entry.status, headers: { 'Content-Type': 'application/json' } })
}

async function withApi(handler, run) {
  const previous = globalThis.fetch
  startSession({ token: 'contract-token', expiresIn: 3600000 })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers }
    calls.push(call)
    assert.equal(options.headers.Authorization, 'Bearer contract-token')
    return handler(call)
  }
  try { await run(calls) } finally { globalThis.fetch = previous; clearSession() }
}

test('el OpenAPI real es la versión 1.3.0 y documenta los endpoints usados por el frontend', () => {
  assert.equal(openapi.info.version, '1.3.0')
  for (const [path, method] of [['/payments/gateways', 'get'], ['/payments/checkout', 'post'], ['/payments/verify', 'post'], ['/subscriptions/status', 'get'],
    ['/properties/{id}/verify-registry', 'post'], ['/properties/{id}/legitimacy', 'get'], ['/ai/recommendations', 'post'], ['/messages', 'post'],
    ['/messages/conversations', 'post'], ['/messages/conversations', 'get'], ['/messages/conversations/{conversationId}/messages', 'get'],
    ['/messages/conversations/{conversationId}/export', 'get'], ['/messages/conversations/{conversationId}/export/json', 'get'],
    ['/messages/blocks', 'get'], ['/messages/blocks/{targetUserId}', 'post'], ['/messages/blocks/{targetUserId}', 'delete'],
    ['/simulations/{id}/export/xlsx', 'get'], ['/offers/{offerId}/schedule/export/xlsx', 'get']]) {
    assert.ok(openapi.paths[`/api/v1${path}`]?.[method], `${method} ${path}`)
  }
})

test('US05 + US06: pasarelas, rechazo 402 con reintento y verificación con el contrato real', async () => {
  await withApi(call => {
    if (call.url.endsWith('/payments/gateways')) return respond('paymentGateways')
    if (call.url.endsWith('/payments/checkout')) return respond(call.body.cardToken.includes('DECLINED') ? 'checkoutRejected' : 'checkoutApproved')
    if (call.url.endsWith('/payments/verify')) return respond('paymentVerified')
    if (call.url.endsWith('/subscriptions/status')) return respond('subscriptionStatusActive')
    throw new Error(`URL inesperada ${call.url}`)
  }, async calls => {
    const gateways = await listPaymentGateways()
    assert.deepEqual(gateways.map(g => g.code), ['CULQI', 'IZIPAY', 'STRIPE'])
    assert.equal(gateways[0].planFees.PREMIUM, '49.90')

    const rejected = await checkoutPayment({ gatewayCode: 'IZIPAY', planName: 'PREMIUM', cardToken: 'tok_DECLINED_INSUFFICIENT_FUNDS' })
    assert.equal(rejected.status, 'REJECTED')
    assert.equal(rejected.declineCode, 'INSUFFICIENT_FUNDS')
    assert.equal(rejected.retryAllowed, true)
    assertMatchesRequestSchema(calls.at(-1).body, '/payments/checkout')

    const approved = await checkoutPayment({ gatewayCode: 'CULQI', planName: 'PREMIUM', cardToken: 'tok_visa_approved' })
    assert.equal(approved.status, 'APPROVED')
    assert.match(approved.transactionReference, /^CULQI-[0-9a-f]{32}-[0-9a-f]{40}$/)

    const receipt = await verifyPayment({ transactionReference: approved.transactionReference, paymentMethod: approved.gatewayCode,
      amount: approved.amount, currency: approved.currency, planName: approved.planName })
    const sent = calls.at(-1).body
    assert.deepEqual(Object.keys(sent).sort(), ['amount', 'currency', 'paymentMethod', 'planName', 'transactionReference'])
    assertMatchesRequestSchema(sent, '/payments/verify')
    assert.equal(receipt.subscriptionStatus, 'ACTIVE')
    assert.equal(receipt.paymentStatus, 'COMPLETED')

    const summary = subscriptionSummary(await getSubscriptionStatus())
    assert.deepEqual({ plan: summary.plan, badge: summary.badge, payments: summary.payments }, { plan: 'PREMIUM', badge: 'ACTIVA', payments: 1 })
    assert.match(summary.validUntil, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(summary.description.includes('PREMIUM'))
  })
  assert.equal(subscriptionSummary(contracts.subscriptionStatusInitial.response).plan, 'Gratuito (sin suscripción)')
  assert.equal(subscriptionSummary(contracts.subscriptionStatusInitial.response).payments, 0)
})

test('US06: el 422 real del backend llega como error con detalle RFC 7807', async () => {
  await withApi(() => respond('paymentRejected422'), async () => {
    await assert.rejects(verifyPayment({ transactionReference: 'TX', paymentMethod: 'CULQI', amount: '0.01', planName: 'PRO' }),
      error => error.status === 422 && error.body.type.endsWith('/unprocessable-entity') && error.message.length > 0)
  })
})

test('US09: verificación SUNARP con { registryNumber, claimedOwner } y badge desde PropertyResponse real', async () => {
  const propertyId = contracts.propertyCreated.response.id
  await withApi(call => call.url.endsWith('/verify-registry') ? respond('registryVerified') : respond('legitimacy'), async calls => {
    const report = await verifyPropertyRegistry(propertyId, { registryNumber: ' 14298172 ', claimedOwner: 'Contrato Owner' })
    assert.deepEqual(calls[0].body, { registryNumber: '14298172', claimedOwner: 'Contrato Owner' })
    assertMatchesRequestSchema(calls[0].body, '/properties/{id}/verify-registry')
    assert.equal(report.status, 'VERIFIED_GENUINE')
    assert.match(report.certificateHash, /^[0-9a-f]{64}$/)
    const legitimacy = await getPropertyLegitimacy(propertyId)
    assert.equal(legitimacy.certificateHash, report.certificateHash)
  })
  const card = contracts.propertyPage.response.items.find(item => item.id === propertyId)
  const badge = legitimacyBadge(card)
  assert.equal(badge.label, 'Verificado SUNARP')
  assert.equal(badge.css, 'badge-verified')
  assert.equal(badge.hash, contracts.registryVerified.response.certificateHash)
  assert.equal(legitimacyBadge(contracts.propertyCreated.response).label, 'Sin verificación registral')
  assert.equal(legitimacyBadge({ legitimacyStatus: 'FLAGGED_ANOMALY' }).css, 'badge-rejected')
  assert.equal(contracts.registryForbidden.status, 403)
})

test('US12: exportaciones .xlsx descargan el binario con token y rutas reales', async () => {
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
  await withApi(call => {
    assert.match(call.url, /\/(simulations\/sim-1\/export\/xlsx|offers\/off-1\/schedule\/export\/xlsx)$/)
    return new Response(zip, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })
  }, async () => {
    for (const blob of [await downloadSimulationXlsx('sim-1'), await downloadOfferScheduleXlsx('off-1')]) {
      assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04])
    }
  })
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  assert.ok(openapi.paths['/api/v1/simulations/{id}/export/xlsx'].get.responses['200'].content[xlsx])
  assert.ok(openapi.paths['/api/v1/offers/{offerId}/schedule/export/xlsx'].get.responses['200'].content[xlsx])
})

test('US15: el asesor envía el AiRecommendationRequest real y lee los campos planos de la respuesta', async () => {
  await withApi(() => respond('aiRecommendations'), async calls => {
    const response = await getAiPropertyRecommendations({ monthlyIncome: '6000.00', currency: 'PEN', downPaymentAvailable: '50000.00',
      preferredDistrict: ' Miraflores ', desiredTermYears: 20, preferenceTags: ['terraza'] })
    assert.deepEqual(calls[0].body, { monthlyIncome: '6000.00', downPaymentAvailable: '50000.00', currency: 'PEN',
      preferredDistrict: 'Miraflores', desiredTermYears: 20, preferenceTags: ['terraza'] })
    assertMatchesRequestSchema(calls[0].body, '/ai/recommendations')
    const view = advisorView(response)
    assert.equal(view.maxAllowableInstallment, '2100.00')
    assert.ok(view.summary.includes('35%'))
    assert.ok(view.analyzed >= 1)
    const top = view.recommendations[0]
    for (const field of ['relevanceScore', 'debtToIncomeRatioPercent', 'financiallyViable', 'recommendationReason', 'estimatedMonthlyInstallment']) {
      assert.ok(field in top, `falta ${field} en la respuesta real`)
    }
    assert.match(top.estimatedMonthlyInstallment, /^\d+\.\d{2}$/)
    assert.equal(top.ratioLabel, `${top.debtToIncomeRatioPercent} %`)
  })
  await withApi(() => respond('aiRecommendations'), async calls => {
    await getAiPropertyRecommendations({ monthlyIncome: '9000', downPaymentAvailable: '', preferredDistrict: '' })
    assert.equal(calls[0].body.downPaymentAvailable, null)
    assert.equal(calls[0].body.preferredDistrict, null)
  })
})

test('US16: conversaciones reales con UUID, bandeja y mensajes recibidos', async () => {
  const conversation = contracts.conversationCreated.response
  const ownerId = conversation.counterpartId
  await withApi(call => {
    if (call.url.endsWith('/messages/conversations') && call.method === 'POST') return respond('conversationCreated')
    if (call.url.endsWith('/messages/conversations')) return respond('conversations')
    if (call.url.endsWith('/messages')) return call.url.includes('/conversations/') ? respond('messages') : respond('messageSent')
    throw new Error(`URL inesperada ${call.url}`)
  }, async calls => {
    const created = await startConversation({ recipientId: ownerId, propertyId: conversation.propertyId })
    assertMatchesRequestSchema(calls[0].body, '/messages/conversations')
    assert.ok(isUuid(created.conversationId))
    const sent = await sendMessage({ conversationId: created.conversationId, content: '¿Sigue disponible?' })
    assert.deepEqual(Object.keys(calls[1].body).sort(), ['content', 'conversationId'])
    assertMatchesRequestSchema(calls[1].body, '/messages')
    assert.equal(sent.recipientId, ownerId)
    const inbox = await listConversations()
    assert.equal(inbox[0].conversationId, created.conversationId)
    assert.equal(inbox[0].messageCount, 1)
    const thread = threadView(await listMessages(created.conversationId), ownerId)
    assert.equal(thread[0].incoming, true)
    assert.equal(thread[0].content, '¿Sigue disponible?')
  })
  assert.throws(() => sendMessage({ conversationId: 'conv-general-001', content: 'x' }), /UUID/)
  assert.equal(contracts.conversationForbidden.status, 403)
})

test('US17: bloqueos leen blockId/blockedId reales; US18 exporta con el UUID real', async () => {
  const blockedId = contracts.blockCreated.response.blockedId
  const conversationId = contracts.conversationExportJson.response.conversationId
  await withApi(call => {
    if (call.url.includes('/messages/blocks/') && call.method === 'POST') return respond('blockCreated')
    if (call.url.includes('/messages/blocks/') && call.method === 'DELETE') return new Response(null, { status: 204 })
    if (call.url.endsWith('/messages/blocks')) return respond('blocks')
    if (call.url.endsWith('/export/json')) return respond('conversationExportJson')
    if (call.url.endsWith('/export')) return new Response(contracts.conversationExportJson.response.formattedTranscript, { status: 200, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
    throw new Error(`URL inesperada ${call.url}`)
  }, async calls => {
    const block = await blockUser(blockedId, 'Spam repetitivo')
    assertMatchesRequestSchema(calls[0].body, '/messages/blocks/{targetUserId}')
    assert.ok(isUuid(block.blockId))
    const list = await listBlockedUsers()
    assert.equal(list[0].blockedId, blockedId)
    assert.ok('blockId' in list[0] && !('blockedUserId' in list[0]))
    await unblockUser(list[0].blockedId)
    assert.ok(calls.at(-1).url.endsWith(`/messages/blocks/${blockedId}`))
    const txt = await exportConversationText(conversationId)
    assert.ok((await txt.text()).includes('CREDICASA - HISTORIAL OFICIAL'))
    const json = JSON.parse(await (await exportConversationJson(conversationId)).text())
    assert.equal(json.conversationId, conversationId)
    assert.equal(json.totalMessages, 1)
  })
  assert.throws(() => blockUser('undefined'), /UUID/)
  assert.equal(contracts.messageBlocked409.status, 409)
  assert.equal(contracts.messageBlocked409.response.status, 409)
})
