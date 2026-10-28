import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDate, formatRate } from '../src/offers/format.js'
import { formatMoney, installmentFields, moneyMetrics, percentToDecimal, rateMetrics, requireCompleteSchedule, simulationDefaults, simulationPayload, validDate, validateSimulation } from '../src/simulations/model.js'
import { calculateSimulation, generateOfferSchedule, getOfferSchedule } from '../src/simulations/api.js'
import { clearSession, startSession } from '../src/account/session.js'

const form = () => ({ ...simulationDefaults(), loanAmount: '200000.00', propertyValue: '250000.00', termMonths: '240', teaPercent: '8.123456', startDate: '2027-01-31' })
const result = (months = 1) => ({ quotationId: '00000000-0000-4000-8000-000000000001', currency: 'PEN', loanAmount: '9999999999999999.99', propertyValue: '9999999999999999.99', estimatedMonthlyInstallment: '10000000000000000.00', termMonths: months, metrics: Object.fromEntries([...moneyMetrics, ...rateMetrics].map(([key]) => [key, key === 'van' ? '-9999999999999999.99' : '0'])), schedule: Array.from({ length: months }, (_, index) => ({ installmentNumber: index + 1, dueDate: '2027-02-28', graceType: 'NONE', ...Object.fromEntries(installmentFields.map(([key]) => [key, '0.00'])) })) })

test('TEA percent converts to eight exact decimal places without floating point', () => {
  assert.equal(percentToDecimal('8.123456'), '0.08123456')
  assert.equal(percentToDecimal('0.000001'), '0.00000001')
  assert.equal(percentToDecimal('100'), '1')
  assert.equal(percentToDecimal('0'), '0')
  const payload = simulationPayload({ ...form(), discountPercent: '0' })
  assert.equal(payload.annualInterestRate, '0.08123456')
  assert.equal(payload.discountRateAnnual, '0')
  assert.equal(payload.monthlyAdminFee, '0')
  assert.equal(payload.termMonths, 240)
  assert.equal(payload.startDate, '2027-01-31')
  assert.equal('clientProfile' in payload, false)
})
test('cross validations reject excess principal, rates, grace, balloon, and dates beyond year 9999', () => {
  assert.deepEqual(validateSimulation(form()), {})
  const invalid = validateSimulation({ ...form(), loanAmount: '250000.01', termMonths: '1', teaPercent: '100.000001', startDate: '2027-02-29', gracePeriodType: 'TOTAL', gracePeriodMonths: '1', balloon: true, balloonPaymentAmount: '300000', lifeInsurancePercent: '-1', monthlyAdminFee: '-1', discountPercent: '101' })
  for (const key of ['loanAmount', 'teaPercent', 'startDate', 'gracePeriodMonths', 'lifeInsurancePercent', 'monthlyAdminFee', 'discountPercent']) assert.ok(invalid[key], key)
  assert.ok(validateSimulation({ ...form(), startDate: '9990-01-01', termMonths: '360' }).startDate)
  assert.equal(validDate('2028-02-29'), true)
  assert.equal(validDate('2027-02-29'), false)
  assert.equal(formatDate('2027-02-28'), '28/02/2027')
})
test('valid advanced payload preserves money, COK zero, grace and final-month balloon', () => {
  const values = { ...form(), loanAmount: '9999999999999999.99', propertyValue: '9999999999999999.99', termMonths: '360', gracePeriodType: 'TOTAL', gracePeriodMonths: '36', balloon: true, balloonPaymentAmount: '9999999999999999.99', discountPercent: '0' }
  assert.deepEqual(validateSimulation(values), {})
  const payload = simulationPayload(values)
  assert.equal(payload.loanAmount, '9999999999999999.99')
  assert.equal(payload.balloonPaymentAmount, '9999999999999999.99')
  assert.equal(payload.balloonPaymentMonth, 360)
  assert.equal(payload.gracePeriodMonths, 36)
  assert.equal(payload.discountRateAnnual, '0')
})
test('result formatting preserves zero, negative VAN and amounts above safe integer', () => {
  assert.equal(formatMoney('-9999999999999999.99', 'PEN'), 'S/ -9,999,999,999,999,999.99')
  assert.equal(formatMoney('0.00', 'USD'), 'US$ 0.00')
  assert.equal(formatMoney('10000000000000000.00', 'PEN'), 'S/ 10,000,000,000,000,000.00')
  assert.equal(formatRate('0.00000001'), '0.000001 %')
  assert.equal(formatRate('-0.01'), '-1 %')
})
test('partial schedules, invalid dates, numeric decimals and unsettled final balance are rejected', () => {
  assert.equal(requireCompleteSchedule(result(360)).schedule.length, 360)
  const incomplete = result(); delete incomplete.metrics.totalCost
  assert.throws(() => requireCompleteSchedule(incomplete), /incompleto/)
  const fewer = result(2); fewer.schedule.pop()
  assert.throws(() => requireCompleteSchedule(fewer), /incompleto/)
  const numeric = result(); numeric.loanAmount = 200000
  assert.throws(() => requireCompleteSchedule(numeric), /incompleto/)
  const final = result(); final.schedule[0].finalBalance = '0.01'
  assert.throws(() => requireCompleteSchedule(final), /incompleto/)
  const badDate = result(); badDate.schedule[0].dueDate = '2027-02-30'
  assert.throws(() => requireCompleteSchedule(badDate), /incompleto/)
})
test('API sends exact strings for direct calculation and no client terms for offer GET/POST', async () => {
  const previous = globalThis.fetch
  try {
    startSession({ token: 'schedule-token', expiresIn: 10000 })
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/simulations/calculate')) {
        const body = JSON.parse(options.body)
        assert.equal(body.annualInterestRate, '0.08123456')
        assert.equal(typeof body.loanAmount, 'string')
      } else {
        assert.ok(url.endsWith('/offers/offer-id/schedule'))
        assert.equal(options.body, undefined)
      }
      return new Response(JSON.stringify(result()), { status: options.method === 'POST' ? 201 : 200 })
    }
    await calculateSimulation(simulationPayload(form()))
    await generateOfferSchedule('offer-id')
    await getOfferSchedule('offer-id')
  } finally { globalThis.fetch = previous; clearSession() }
})
