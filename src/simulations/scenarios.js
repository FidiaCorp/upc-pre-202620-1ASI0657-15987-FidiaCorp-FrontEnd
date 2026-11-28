// Sprint 4 — US20: historial de simulaciones propias y comparador de 2 a 3 escenarios (mortgage-pricing-service vía API Gateway).
import { request } from '../services/http.js'
import { simulationPayload, validateSimulation } from './model.js'

const plain = /^-?\d+(?:\.\d+)?$/
const decimal = value => typeof value === 'string' && plain.test(value)
const cents = value => { const [whole, fraction = ''] = value.trim().split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')) }

export const prepaymentStrategies = [['REDUCE_TERM', 'Reducir plazo'], ['REDUCE_INSTALLMENT', 'Reducir cuota']]
export const comparisonCriteria = [['bestByTcea', 'Menor TCEA'], ['bestByTotalInterest', 'Menos intereses'], ['bestByMonthlyInstallment', 'Menor cuota'], ['bestByVan', 'Mejor VAN para el deudor'], ['bestByTotalCost', 'Menor costo total']]
export const comparisonMetrics = [['monthlyInstallment', 'Cuota mensual', 'money'], ['tea', 'TEA', 'rate'], ['tcea', 'TCEA', 'rate'], ['totalInterest', 'Intereses totales', 'money'], ['totalCost', 'Costo total', 'money'], ['van', 'VAN', 'money'], ['interestSavings', 'Ahorro en intereses por prepago', 'money']]

export function listSimulations({ page = 0, size = 10 } = {}) {
  return request(`/simulations?${new URLSearchParams({ page, size })}`).then(requireSimulationPage)
}
export async function compareScenarios(body) {
  return requireComparison(await request('/simulations/compare', { method: 'POST', body }), body.scenarios.length)
}

export function requireSimulationPage(value) {
  const fail = () => { throw new Error('El servidor devolvió un historial de simulaciones inválido.') }
  if (!value || !Array.isArray(value.items) || !Number.isInteger(value.page) || !Number.isInteger(value.totalPages) || !Number.isFinite(value.totalElements)) fail()
  if (!value.items.every(item => typeof item.quotationId === 'string' && ['PEN', 'USD'].includes(item.currency) && decimal(item.loanAmount) && Number.isInteger(item.termMonths) && ['TEA', 'TNA'].includes(item.rateType) && decimal(item.tea) && decimal(item.tcea))) fail()
  return value
}

export function scenarioDefaults(index = 0) {
  return { label: `Escenario ${String.fromCharCode(65 + index)}`, loanAmount: '', termMonths: '240', rateType: 'TEA', compoundingPeriodsPerYear: '360', teaPercent: '', prepayment: false, afterInstallment: '24', prepaymentAmount: '', strategy: 'REDUCE_TERM' }
}

/** Escenarios comparten moneda, fecha inicial y valor del inmueble para que la comparación sea homogénea. */
export function validateScenarios(common, scenarios) {
  const errors = { common: {}, scenarios: scenarios.map(() => ({})) }
  if (scenarios.length < 2 || scenarios.length > 3) errors.general = 'Compara entre 2 y 3 escenarios.'
  const labels = new Set()
  scenarios.forEach((scenario, index) => {
    const own = errors.scenarios[index]
    const label = scenario.label.trim()
    if (!label || label.length > 60) own.label = 'La etiqueta es obligatoria (máximo 60 caracteres).'
    else if (labels.has(label.toLowerCase())) own.label = 'Cada escenario necesita una etiqueta distinta.'
    labels.add(label.toLowerCase())
    const simulationErrors = validateSimulation(asSimulationForm(common, scenario))
    for (const key of ['loanAmount', 'termMonths', 'teaPercent', 'rateType', 'compoundingPeriodsPerYear']) if (simulationErrors[key]) own[key] = simulationErrors[key]
    for (const key of ['currency', 'startDate', 'propertyValue']) if (simulationErrors[key]) errors.common[key] = simulationErrors[key]
    if (scenario.prepayment) {
      const after = Number(scenario.afterInstallment)
      if (!/^\d+$/.test(String(scenario.afterInstallment)) || after < 1 || after >= Number(scenario.termMonths)) own.afterInstallment = 'El prepago debe aplicarse antes de la última cuota.'
      if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(scenario.prepaymentAmount.trim()) || cents(scenario.prepaymentAmount) <= 0n) own.prepaymentAmount = 'Ingresa un prepago positivo con hasta 2 decimales.'
      else if (!own.loanAmount && /^\d{1,16}(?:\.\d{1,2})?$/.test(scenario.loanAmount.trim()) && cents(scenario.prepaymentAmount) >= cents(scenario.loanAmount)) own.prepaymentAmount = 'El prepago debe ser menor que el préstamo.'
      if (!prepaymentStrategies.some(([value]) => value === scenario.strategy)) own.strategy = 'Selecciona una estrategia de prepago.'
    }
  })
  const count = Object.keys(errors.common).length + errors.scenarios.reduce((total, own) => total + Object.keys(own).length, 0) + (errors.general ? 1 : 0)
  return { ...errors, valid: count === 0 }
}

function asSimulationForm(common, scenario) {
  return { loanAmount: scenario.loanAmount, propertyValue: common.propertyValue || '', currency: common.currency, termMonths: String(scenario.termMonths), rateType: scenario.rateType, compoundingPeriodsPerYear: String(scenario.compoundingPeriodsPerYear), teaPercent: scenario.teaPercent, startDate: common.startDate, propertyAddress: '', gracePeriodType: 'NONE', gracePeriodMonths: '0', balloon: false, balloonPaymentAmount: '', lifeInsurancePercent: '0', propertyInsurancePercent: '0', monthlyAdminFee: '0', discountPercent: common.discountPercent || '' }
}

export function comparisonPayload(common, scenarios) {
  return {
    scenarios: scenarios.map(scenario => ({
      label: scenario.label.trim(),
      simulation: simulationPayload(asSimulationForm(common, scenario)),
      ...(scenario.prepayment ? { extraordinaryPayment: { afterInstallment: Number(scenario.afterInstallment), amount: scenario.prepaymentAmount.trim(), strategy: scenario.strategy } } : {}),
    })),
  }
}

export function requireComparison(value, expected) {
  const fail = () => { throw new Error('El servidor devolvió una comparación incompleta. No se mostrará como resultado válido.') }
  if (!value || !Array.isArray(value.scenarios) || value.scenarios.length !== expected) fail()
  const labels = value.scenarios.map(scenario => scenario.label)
  if (!value.scenarios.every(scenario => typeof scenario.label === 'string' && Number.isInteger(scenario.effectiveTermMonths) && ['monthlyInstallment', 'tea', 'tcea', 'totalInterest', 'totalCost', 'van'].every(key => decimal(scenario[key])) && Array.isArray(scenario.schedule) && scenario.schedule.length === scenario.effectiveTermMonths)) fail()
  if (!comparisonCriteria.every(([key]) => labels.includes(value[key]))) fail()
  return value
}

/** Criterios en los que gana cada escenario (para resaltarlo en la tabla). */
export function winsByLabel(comparison) {
  const wins = Object.fromEntries(comparison.scenarios.map(scenario => [scenario.label, []]))
  for (const [key, label] of comparisonCriteria) wins[comparison[key]]?.push(label)
  return wins
}
