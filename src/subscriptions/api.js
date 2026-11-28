import { request } from '../services/http.js'

/** Contrato real: GET /subscriptions/status → SubscriptionStatusResponse (planName, endDate, statusDescription, paymentCount…). */
export const getSubscriptionStatus = () => request('/subscriptions/status')

/** US05: GET /payments/gateways → [{ code, displayName, currencies, commissionPercent, fixedFee, sandbox, planFees }]. */
export const listPaymentGateways = () => request('/payments/gateways')

/**
 * US05: POST /payments/checkout. 200 → { status: 'APPROVED', transactionReference, … }.
 * Un rechazo de la pasarela (402) se devuelve como resultado REJECTED (no como excepción) para permitir el reintento.
 */
export async function checkoutPayment({ gatewayCode, planName, cardToken }) {
  try {
    return await request('/payments/checkout', { method: 'POST', body: { gatewayCode, planName, cardToken, currency: 'PEN' } })
  } catch (error) {
    if (error.status === 402 && error.body?.status === 'REJECTED') return error.body
    throw error
  }
}

/** US06: POST /payments/verify con el contrato real del backend. */
export const verifyPayment = ({ transactionReference, paymentMethod, amount, currency = 'PEN', planName }) =>
  request('/payments/verify', {
    method: 'POST',
    body: { transactionReference, paymentMethod, amount: String(amount), currency, planName },
  })

export const PAID_PLANS = ['PREMIUM', 'PRO']

export function subscriptionSummary(status) {
  if (!status) return null
  return {
    plan: status.planName === 'FREE_TIER' ? 'Gratuito (sin suscripción)' : status.planName,
    badge: status.active ? 'ACTIVA' : status.status,
    validUntil: status.endDate || null,
    description: status.statusDescription || '',
    payments: Number.isInteger(status.paymentCount) ? status.paymentCount : 0,
  }
}
