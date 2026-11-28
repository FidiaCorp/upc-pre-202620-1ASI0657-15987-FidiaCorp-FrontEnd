import { formatRate } from '../offers/format.js'
// Serie para el gráfico "Evolución de pago del crédito": capital (amortización) e intereses por periodo.
// Mes a mes si el plazo es de hasta 24 cuotas; por año en plazos mayores. Solo para visualización.
const toNumber = value => {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : 0
}

export function paymentSeries(schedule = []) {
  if (!Array.isArray(schedule) || !schedule.length) return { grouping: 'month', buckets: [] }
  const grouping = schedule.length <= 24 ? 'month' : 'year'
  const buckets = []
  schedule.forEach((row, index) => {
    const key = grouping === 'month' ? index : Math.floor(index / 12)
    if (!buckets[key]) {
      buckets[key] = {
        label: grouping === 'month' ? `${row.installmentNumber ?? index + 1}` : `Año ${key + 1}`,
        from: row.installmentNumber ?? index + 1,
        to: row.installmentNumber ?? index + 1,
        principal: 0,
        interest: 0,
      }
    }
    const bucket = buckets[key]
    bucket.to = row.installmentNumber ?? index + 1
    bucket.principal += Math.max(0, toNumber(row.principalAmortization))
    bucket.interest += Math.max(0, toNumber(row.interest))
  })
  return { grouping, buckets: buckets.map(b => ({ ...b, principal: round2(b.principal), interest: round2(b.interest), total: round2(b.principal + b.interest) })) }
}

const round2 = value => Math.round(value * 100) / 100

/** Máximo "bonito" para el eje Y (1, 2, 2.5 o 5 × 10^n) y sus marcas. */
export function niceScale(max, ticks = 4) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] }
  const raw = max / ticks
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(f => f * power).find(s => s >= raw)
  const top = step * Math.ceil(max / step)
  const values = []
  for (let v = 0; v <= top + step / 2; v += step) values.push(round2(v))
  return { max: top, ticks: values }
}

export function compactAmount(value) {
  if (value >= 1_000_000) return `${round1(value / 1_000_000)} M`
  if (value >= 1_000) return `${round1(value / 1_000)} k`
  return `${Math.round(value)}`
}
const round1 = value => (Math.round(value * 10) / 10).toString()

/** Tasa legible para tarjetas y tablas: el mismo valor de formatRate (fracción → %), redondeado a `decimals`. */
export function shortRate(value, decimals = 4) {
  const exact = formatRate(value)
  const match = /^(-?\d+(?:\.\d+)?) %$/.exec(exact)
  if (!match) return exact
  const rounded = Number(match[1]).toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return `${rounded === '-0' ? '0' : rounded} %`
}
