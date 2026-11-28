import { request } from '../services/http.js'

/**
 * US15 — contrato real de AiRecommendationRequest:
 * { monthlyIncome, downPaymentAvailable, currency, preferredDistrict, desiredTermYears, preferenceTags }.
 */
export const getAiPropertyRecommendations = ({
  monthlyIncome,
  currency = 'PEN',
  downPaymentAvailable = null,
  preferredDistrict = '',
  desiredTermYears = 20,
  preferenceTags = [],
}) =>
  request('/ai/recommendations', {
    method: 'POST',
    body: {
      monthlyIncome: String(monthlyIncome).trim(),
      downPaymentAvailable: downPaymentAvailable === null || String(downPaymentAvailable).trim() === '' ? null : String(downPaymentAvailable).trim(),
      currency,
      preferredDistrict: preferredDistrict?.trim() || null,
      desiredTermYears: Number(desiredTermYears),
      preferenceTags: Array.isArray(preferenceTags) ? preferenceTags : [],
    },
  })

/** Vista del AiRecommendationResponse real (campos planos, importes como cadenas decimales). */
export function advisorView(response) {
  if (!response) return null
  return {
    currency: response.currency,
    maxAllowableInstallment: response.maxAllowableInstallment,
    summary: response.evaluationSummary,
    analyzed: response.totalAnalyzed,
    viable: (response.recommendations || []).filter(r => r.financiallyViable).length,
    recommendations: (response.recommendations || []).map(r => ({
      ...r,
      ratioLabel: `${r.debtToIncomeRatioPercent} %`,
      viabilityLabel: r.financiallyViable ? 'Dentro del 35 % SBS' : 'Supera el 35 % SBS',
    })),
  }
}
