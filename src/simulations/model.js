const plain = /^-?\d+(?:\.\d+)?$/
export function formatMoney(value, currency) {
  if (typeof value !== 'string' || !plain.test(value)) return 'No disponible'
  const [integer, fraction = ''] = value.split('.')
  return `${currency === 'PEN' ? 'S/' : currency === 'USD' ? 'US$' : currency} ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}
export function percentToDecimal(value) {
  const [integer, fraction = ''] = value.trim().split('.')
  const digits = `${integer}${fraction}`.padStart(fraction.length + 3, '0')
  return `${digits.slice(0, -fraction.length - 2).replace(/^0+(?=\d)/, '')}.${digits.slice(-fraction.length - 2)}`.replace(/0+$/, '').replace(/\.$/, '')
}
const validMoney = (value, zero = false) => /^\d{1,16}(?:\.\d{1,2})?$/.test(value.trim()) && (zero || BigInt(value.replace('.', '').trim()) > 0n)
const cents = value => { const [whole, fraction = ''] = value.trim().split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')) }
const validPercent = (value, zero = false) => /^\d{1,3}(?:\.\d{1,6})?$/.test(value.trim()) && (zero || BigInt(value.replace('.', '').trim()) > 0n) && BigInt(value.split('.')[0]) <= 100n && (BigInt(value.split('.')[0]) < 100n || !/[1-9]/.test(value.split('.')[1] || ''))
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}
export function simulationDefaults() {
  return { loanAmount: '', propertyValue: '', currency: 'PEN', termMonths: '240', teaPercent: '', startDate: new Date().toISOString().slice(0, 10), propertyAddress: '', gracePeriodType: 'NONE', gracePeriodMonths: '0', balloon: false, balloonPaymentAmount: '', lifeInsurancePercent: '0', propertyInsurancePercent: '0', monthlyAdminFee: '0', discountPercent: '' }
}
export function validateSimulation(form) {
  const errors = {}
  if (!validMoney(form.loanAmount)) errors.loanAmount = 'Ingresa un préstamo positivo de hasta 16 enteros y 2 decimales.'
  if (form.propertyValue.trim() && !validMoney(form.propertyValue)) errors.propertyValue = 'Ingresa un valor positivo de hasta 16 enteros y 2 decimales.'
  if (!errors.loanAmount && !errors.propertyValue && form.propertyValue.trim() && cents(form.loanAmount) > cents(form.propertyValue)) errors.loanAmount = 'El préstamo no puede superar el valor del inmueble.'
  if (!['PEN', 'USD'].includes(form.currency)) errors.currency = 'Selecciona soles o dólares.'
  const months = Number(form.termMonths)
  if (!/^\d+$/.test(form.termMonths) || months < 1 || months > 360) errors.termMonths = 'El plazo debe ser un entero entre 1 y 360 meses.'
  if (!validPercent(form.teaPercent)) errors.teaPercent = 'Ingresa una TEA mayor que 0 y hasta 100 %, con hasta 6 decimales.'
  if (!validDate(form.startDate) || form.startDate < '1900-01-01' || form.startDate > '9990-12-31') errors.startDate = 'Ingresa una fecha válida entre 1900 y 9990.'
  else if (!errors.termMonths && Number(form.startDate.slice(0, 4)) + Math.floor((Number(form.startDate.slice(5, 7)) - 1 + months) / 12) > 9999) errors.startDate = 'La última cuota no puede superar el año 9999.'
  if (form.propertyAddress.trim().length > 250) errors.propertyAddress = 'La dirección admite hasta 250 caracteres.'
  if (!['NONE', 'PARTIAL', 'TOTAL'].includes(form.gracePeriodType)) errors.gracePeriodType = 'Selecciona un tipo de gracia válido.'
  if (form.gracePeriodType !== 'NONE' && (!/^\d+$/.test(form.gracePeriodMonths) || Number(form.gracePeriodMonths) < 1 || Number(form.gracePeriodMonths) > 36 || Number(form.gracePeriodMonths) >= months)) errors.gracePeriodMonths = 'La gracia debe ser de 1 a 36 meses y menor al plazo.'
  if (form.balloon && !validMoney(form.balloonPaymentAmount)) errors.balloonPaymentAmount = 'Ingresa un balón positivo de hasta 16 enteros y 2 decimales.'
  else if (form.balloon && !errors.loanAmount && cents(form.balloonPaymentAmount) > cents(form.loanAmount)) errors.balloonPaymentAmount = 'El balón no puede superar el préstamo.'
  for (const key of ['lifeInsurancePercent', 'propertyInsurancePercent']) if (!validPercent(form[key], true)) errors[key] = 'Ingresa un porcentaje de 0 a 100, con hasta 6 decimales.'
  if (!validMoney(form.monthlyAdminFee, true)) errors.monthlyAdminFee = 'Ingresa un gasto no negativo de hasta 16 enteros y 2 decimales.'
  if (form.discountPercent.trim() && !validPercent(form.discountPercent, true)) errors.discountPercent = 'Ingresa un COK entre 0 y 100 %, con hasta 6 decimales.'
  return errors
}
export function simulationPayload(form) {
  return {
    loanAmount: form.loanAmount.trim(), ...(form.propertyValue.trim() ? { propertyValue: form.propertyValue.trim() } : {}), currency: form.currency, termMonths: Number(form.termMonths), annualInterestRate: percentToDecimal(form.teaPercent), startDate: form.startDate,
    propertyAddress: form.propertyAddress.trim(), gracePeriodType: form.gracePeriodType, gracePeriodMonths: form.gracePeriodType === 'NONE' ? 0 : Number(form.gracePeriodMonths),
    balloonPaymentAmount: form.balloon ? form.balloonPaymentAmount.trim() : '0', ...(form.balloon ? { balloonPaymentMonth: Number(form.termMonths) } : {}),
    lifeInsuranceRate: percentToDecimal(form.lifeInsurancePercent), propertyInsuranceRate: percentToDecimal(form.propertyInsurancePercent), monthlyAdminFee: form.monthlyAdminFee.trim(), ...(form.discountPercent.trim() ? { discountRateAnnual: percentToDecimal(form.discountPercent) } : {}),
  }
}
export const moneyMetrics = [['van', 'VAN'], ['totalInterest', 'Intereses devengados'], ['totalPrincipal', 'Amortización total'], ['totalLifeInsurance', 'Seguro de desgravamen total'], ['totalPropertyInsurance', 'Seguro del inmueble total'], ['totalAdminFee', 'Gastos administrativos totales'], ['totalCost', 'Costo total']]
export const rateMetrics = [['tea', 'TEA'], ['tem', 'TEM'], ['monthlyTir', 'TIR mensual'], ['tcea', 'TCEA'], ['discountRateUsed', 'COK anual']]
export const installmentFields = [['initialBalance', 'Saldo inicial'], ['interest', 'Interés'], ['principalAmortization', 'Amortización'], ['installmentAmount', 'Cuota sin cargos'], ['lifeInsurance', 'Desgravamen'], ['propertyInsurance', 'Seguro inmueble'], ['adminFee', 'Gastos'], ['totalPayment', 'Pago total'], ['finalBalance', 'Saldo final']]
export function requireCompleteSchedule(value) {
  const decimal = value => typeof value === 'string' && plain.test(value)
  const fail = () => { throw new Error('El servidor devolvió un cronograma incompleto o inválido. No se mostrará como resultado válido.') }
  if (!value?.quotationId || !['PEN', 'USD'].includes(value.currency) || !Number.isInteger(value.termMonths) || value.termMonths < 1 || value.termMonths > 360 || !Array.isArray(value.schedule) || value.schedule.length !== value.termMonths) fail()
  if (!['loanAmount', 'propertyValue', 'estimatedMonthlyInstallment'].every(key => decimal(value[key]))) fail()
  if (![...moneyMetrics, ...rateMetrics].every(([key]) => decimal(value.metrics?.[key]))) fail()
  if (!value.schedule.every((row, index) => row.installmentNumber === index + 1 && validDate(row.dueDate) && installmentFields.every(([key]) => decimal(row[key])) && ['NONE', 'PARTIAL', 'TOTAL'].includes(row.graceType))) fail()
  if (!/^-?0+(?:\.0+)?$/.test(value.schedule.at(-1).finalBalance)) fail()
  return value
}
export const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
