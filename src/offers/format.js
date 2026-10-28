export function formatRate(value) {
  if (typeof value !== 'string' || ! /^-?\d+(?:\.\d+)?$/.test(value)) return 'Tasa no disponible'
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  const digits = `${whole}${fraction.padEnd(2, '0')}`
  const scale = Math.max(0, fraction.length - 2)
  const integer = BigInt(digits).toString().padStart(scale + 1, '0')
  const result = scale ? `${integer.slice(0, -scale)}.${integer.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '') : integer
  return `${negative ? '-' : ''}${result} %`
}
export function formatDate(value) {
  if (!value) return 'No disponible'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/')
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No disponible' : date.toLocaleString('es-PE')
}
