import { request } from '../services/http.js'

export const getAiPropertyRecommendations = ({
  monthlyIncome,
  currency = 'PEN',
  downPayment = '0.00',
  preferredDistrict = '',
  maxLoanTermMonths = 240,
  preferredTags = [],
}) =>
  request('/ai/recommendations', {
    method: 'POST',
    body: {
      monthlyIncome: String(monthlyIncome),
      currency,
      downPayment: String(downPayment),
      preferredDistrict: preferredDistrict.trim(),
      maxLoanTermMonths: Number(maxLoanTermMonths),
      preferredTags: Array.isArray(preferredTags) ? preferredTags : [],
    },
  })
