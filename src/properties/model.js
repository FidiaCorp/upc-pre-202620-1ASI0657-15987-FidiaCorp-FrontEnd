export function parseTags(text) {
  if (!text.trim()) return []
  return [...new Set(text.split(',').map(tag => tag.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ')))]
}
export function validateTags(tags) {
  if (tags.length > 20) return 'Usa como máximo 20 etiquetas.'
  if (tags.some(tag => !tag || tag.length > 40)) return 'Cada etiqueta debe tener entre 1 y 40 caracteres.'
  return ''
}
export function normalizePrice(value) {
  const [integer, fraction = ''] = value.trim().split('.')
  return `${integer.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`
}
export function validPrice(value) {
  const text = value.trim()
  return /^\d{1,16}(?:\.\d{1,2})?$/.test(text) && BigInt(text.replace('.', '')) > 0n
}
export function formatPrice(value, currency) {
  if (typeof value !== 'string' || !validPrice(value)) return 'Precio no disponible'
  const [integer, fraction] = normalizePrice(value).split('.')
  return `${currency === 'PEN' ? 'S/' : currency === 'USD' ? 'US$' : currency} ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`
}
export function validateProperty(form) {
  const errors = {}
  for (const [key, label, max] of [['title', 'El título', 120], ['address', 'La dirección', 250]]) {
    if (!form[key].trim()) errors[key] = `${label} es obligatorio.`
    else if (form[key].trim().length > max) errors[key] = `${label} admite hasta ${max} caracteres.`
  }
  if (form.description.trim().length > 2000) errors.description = 'La descripción admite hasta 2000 caracteres.'
  if (!validPrice(form.price)) errors.price = 'Ingresa un precio mayor que cero, con hasta 16 dígitos enteros y 2 decimales (usa punto decimal).'
  if (!['PEN', 'USD'].includes(form.currency)) errors.currency = 'Selecciona soles o dólares.'
  const tagsError = validateTags(parseTags(form.tags))
  if (tagsError) errors.tags = tagsError
  return errors
}
export function propertyPayload(form) {
  return { title: form.title.trim(), address: form.address.trim(), description: form.description.trim(), price: normalizePrice(form.price), currency: form.currency, tags: parseTags(form.tags) }
}
export function propertyQuery({ q = '', tags = [], mine = false, page = 0, size = 20 }) {
  const query = new URLSearchParams({ q: q.trim(), mine: String(mine), page: String(page), size: String(size) })
  for (const tag of tags) query.append('tags', tag)
  return query.toString()
}
