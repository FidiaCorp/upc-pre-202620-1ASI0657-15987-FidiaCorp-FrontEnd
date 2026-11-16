import { request } from '../services/http.js'

export const getSubscriptionStatus = () => request('/subscriptions/status')

export const verifyPayment = ({ subscriptionPlan = 'BASIC', amount, currency = 'PEN', externalPaymentId }) =>
  request('/payments/verify', {
    method: 'POST',
    body: {
      subscriptionPlan,
      amount: String(amount),
      currency,
      externalPaymentId,
    },
  })
