import test from 'node:test'
import assert from 'node:assert/strict'
import { clearSession, startSession } from '../src/account/session.js'
import { getSubscriptionStatus, verifyPayment } from '../src/subscriptions/api.js'
import { getPropertyLegitimacy, verifyPropertyRegistry } from '../src/properties/api.js'
import { downloadOfferScheduleXlsx, downloadSimulationXlsx } from '../src/simulations/api.js'
import { getAiPropertyRecommendations } from '../src/simulations/ai-api.js'
import {
  blockUser,
  exportConversationJson,
  exportConversationText,
  listBlockedUsers,
  sendMessage,
  unblockUser,
} from '../src/messaging/api.js'

test('US06: subscription status returns active plan and payment verification confirms subscription', async () => {
  const previousFetch = globalThis.fetch
  try {
    startSession({ token: 'sub-token-123', expiresIn: 3600 })

    globalThis.fetch = async (url, options) => {
      if (url.includes('/subscriptions/status')) {
        assert.equal(options.headers.Authorization, 'Bearer sub-token-123')
        return new Response(
          JSON.stringify({
            id: 'sub-001',
            userId: 'user-001',
            plan: 'PREMIUM',
            status: 'ACTIVE',
            expiresAt: '2026-12-31T23:59:59Z',
            active: true,
            paymentCount: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/payments/verify')) {
        const body = JSON.parse(options.body)
        assert.equal(body.subscriptionPlan, 'PREMIUM')
        assert.equal(body.amount, '49.90')
        assert.equal(body.currency, 'PEN')
        assert.equal(body.externalPaymentId, 'OPER-987654')
        return new Response(
          JSON.stringify({
            paymentId: 'pay-001',
            status: 'CONFIRMED',
            subscriptionId: 'sub-001',
            plan: 'PREMIUM',
            subscriptionStatus: 'ACTIVE',
            expiresAt: '2026-12-31T23:59:59Z',
            confirmedAt: '2026-11-15T12:00:00Z',
            message: 'Pago confirmado exitosamente.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Unexpected URL: ${url}`)
    }

    const status = await getSubscriptionStatus()
    assert.equal(status.active, true)
    assert.equal(status.plan, 'PREMIUM')

    const paymentRes = await verifyPayment({
      subscriptionPlan: 'PREMIUM',
      amount: '49.90',
      currency: 'PEN',
      externalPaymentId: 'OPER-987654',
    })
    assert.equal(paymentRes.status, 'CONFIRMED')
    assert.equal(paymentRes.subscriptionStatus, 'ACTIVE')
  } finally {
    globalThis.fetch = previousFetch
    clearSession()
  }
})

test('US09: SUNARP registry verification validates property authenticity and legitimacy report', async () => {
  const previousFetch = globalThis.fetch
  try {
    startSession({ token: 'sunarp-token', expiresIn: 3600 })

    globalThis.fetch = async (url, options) => {
      if (url.includes('/verify-registry') && options.method === 'POST') {
        const body = JSON.parse(options.body)
        assert.equal(body.electronicEntry, '14298172')
        assert.equal(body.registryOffice, 'ZONA IX - SEDE LIMA')
        assert.equal(body.titleSheetNumber, 'P03192831')
        return new Response(
          JSON.stringify({
            propertyId: 'prop-100',
            legitimacyStatus: 'VERIFIED',
            sunarpVerified: true,
            electronicEntry: '14298172',
            registryOffice: 'ZONA IX - SEDE LIMA',
            titleSheetNumber: 'P03192831',
            verifiedAt: '2026-11-15T12:00:00Z',
            certificateHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/legitimacy') && options.method === 'GET') {
        return new Response(
          JSON.stringify({
            propertyId: 'prop-100',
            legitimacyStatus: 'VERIFIED',
            sunarpVerified: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Unexpected URL: ${url}`)
    }

    const report = await verifyPropertyRegistry('prop-100', {
      electronicEntry: '14298172',
      registryOffice: 'ZONA IX - SEDE LIMA',
      titleSheetNumber: 'P03192831',
    })
    assert.equal(report.legitimacyStatus, 'VERIFIED')
    assert.equal(report.sunarpVerified, true)
    assert.ok(report.certificateHash)

    const fetchedReport = await getPropertyLegitimacy('prop-100')
    assert.equal(fetchedReport.legitimacyStatus, 'VERIFIED')
  } finally {
    globalThis.fetch = previousFetch
    clearSession()
  }
})

test('US12: simulation and offer schedule xlsx exports request binary sheet download with auth token', async () => {
  const previousFetch = globalThis.fetch
  try {
    startSession({ token: 'xlsx-token', expiresIn: 3600 })

    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer xlsx-token')
      if (url.includes('/simulations/sim-456/export/xlsx')) {
        const fakeZipBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
        return new Response(fakeZipBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="cronograma_sim-456.xlsx"',
          },
        })
      }
      if (url.includes('/offers/off-789/schedule/export/xlsx')) {
        const fakeZipBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
        return new Response(fakeZipBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    }

    const simBlob = await downloadSimulationXlsx('sim-456')
    assert.ok(simBlob instanceof Blob)
    assert.equal(simBlob.size, 4)

    const offBlob = await downloadOfferScheduleXlsx('off-789')
    assert.ok(offBlob instanceof Blob)
    assert.equal(offBlob.size, 4)
  } finally {
    globalThis.fetch = previousFetch
    clearSession()
  }
})

test('US15: AI recommendation engine evaluates borrower solvency and returns ranked properties', async () => {
  const previousFetch = globalThis.fetch
  try {
    startSession({ token: 'ai-token', expiresIn: 3600 })

    globalThis.fetch = async (url, options) => {
      if (url.includes('/ai/recommendations')) {
        const body = JSON.parse(options.body)
        assert.equal(body.monthlyIncome, '7500')
        assert.equal(body.currency, 'PEN')
        assert.equal(body.downPayment, '50000')
        assert.equal(body.preferredDistrict, 'Surco')
        assert.equal(body.maxLoanTermMonths, 240)
        assert.deepEqual(body.preferredTags, ['terraza', 'estacionamiento'])

        return new Response(
          JSON.stringify({
            borrowerEvaluation: {
              monthlyIncome: 7500.0,
              currency: 'PEN',
              maxAffordableMonthlyInstallment: 2625.0,
              maxLoanCapacity: 262500.0,
              maxPropertyPrice: 312500.0,
              debtToIncomeRatioPercent: '35%',
            },
            recommendations: [
              {
                propertyId: 'prop-surco-1',
                title: 'Departamento Vista Alegre',
                address: 'Av. Los Próceres 340',
                price: 285000.0,
                currency: 'PEN',
                district: 'Surco',
                tags: ['terraza', 'estacionamiento'],
                estimatedMonthlyInstallment: 2410.0,
                debtRatioPercent: '32.1%',
                legitimacyStatus: 'VERIFIED',
                recommendationScore: 96,
                recommendationReason: 'Excelente compatibilidad de cuota bajo el límite SBS del 35%.',
              },
            ],
            totalEvaluated: 12,
            recommendationsCount: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Unexpected URL: ${url}`)
    }

    const result = await getAiPropertyRecommendations({
      monthlyIncome: '7500',
      currency: 'PEN',
      downPayment: '50000',
      preferredDistrict: 'Surco',
      maxLoanTermMonths: 240,
      preferredTags: ['terraza', 'estacionamiento'],
    })

    assert.equal(result.borrowerEvaluation.debtToIncomeRatioPercent, '35%')
    assert.equal(result.recommendationsCount, 1)
    assert.equal(result.recommendations[0].recommendationScore, 96)
    assert.equal(result.recommendations[0].district, 'Surco')
  } finally {
    globalThis.fetch = previousFetch
    clearSession()
  }
})

test('US17: messaging block controls prevent unwanted interactions and list blocks', async () => {
  const previousFetch = globalThis.fetch
  try {
    startSession({ token: 'msg-token', expiresIn: 3600 })

    globalThis.fetch = async (url, options) => {
      if (url.includes('/messages/blocks/target-user-1') && options.method === 'POST') {
        const body = JSON.parse(options.body)
        assert.equal(body.reason, 'Spam repetitivo')
        return new Response(
          JSON.stringify({
            id: 'block-01',
            blockerUserId: 'my-user-id',
            blockedUserId: 'target-user-1',
            reason: 'Spam repetitivo',
            blockedAt: '2026-11-15T12:00:00Z',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/messages/blocks/target-user-1') && options.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      if (url.includes('/messages/blocks') && options.method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              id: 'block-01',
              blockedUserId: 'target-user-1',
              reason: 'Spam repetitivo',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Unexpected URL: ${url}`)
    }

    const blockRes = await blockUser('target-user-1', 'Spam repetitivo')
    assert.equal(blockRes.blockedUserId, 'target-user-1')

    const blocksList = await listBlockedUsers()
    assert.equal(blocksList.length, 1)
    assert.equal(blocksList[0].blockedUserId, 'target-user-1')

    await unblockUser('target-user-1')
  } finally {
    globalThis.fetch = previousFetch
    clearSession()
  }
})

test('US18: conversation history export downloads transcripts in TXT and JSON formats', async () => {
  const previousFetch = globalThis.fetch
  try {
    startSession({ token: 'chat-token', expiresIn: 3600 })

    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer chat-token')
      if (url.includes('/messages/conversations/conv-123/export/json')) {
        return new Response(
          JSON.stringify({
            conversationId: 'conv-123',
            totalMessages: 2,
            messages: [
              { senderId: 'user-a', content: 'Hola, ¿sigue disponible el departamento?', sentAt: '2026-11-15T10:00:00Z' },
              { senderId: 'user-b', content: 'Sí, podemos coordinar visita.', sentAt: '2026-11-15T10:05:00Z' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/messages/conversations/conv-123/export')) {
        const textContent = '========================================\nFIDICORP - HISTORIAL DE CONVERSACION\n========================================'
        return new Response(textContent, {
          status: 200,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    }

    const txtBlob = await exportConversationText('conv-123')
    assert.ok(txtBlob instanceof Blob)

    const jsonBlob = await exportConversationJson('conv-123')
    assert.ok(jsonBlob instanceof Blob)
  } finally {
    globalThis.fetch = previousFetch
    clearSession()
  }
})
