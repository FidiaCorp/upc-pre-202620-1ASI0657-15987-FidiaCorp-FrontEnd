// Fotografías locales (public/images) asignadas de forma determinista a cada inmueble, sin depender del backend.
export const DISTRICT_PHOTOS = [
  ['miraflores', '/images/prop-miraflores.jpg'],
  ['surco', '/images/prop-surco.jpg'],
  ['san isidro', '/images/prop-san-isidro.jpg'],
  ['san borja', '/images/prop-san-borja.jpg'],
  ['jesus maria', '/images/prop-jesus-maria.jpg'],
  ['barranco', '/images/prop-barranco.jpg'],
]
export const HERO_PHOTO = '/images/hero-login-house.jpg'

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')

/** Hash FNV-1a de 32 bits: estable entre sesiones y navegadores. */
export function stableHash(value) {
  let hash = 0x811c9dc5
  for (const char of String(value ?? '')) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Distrito reconocido en dirección, título, etiquetas o descripción; null si no se reconoce. */
export function detectDistrict(property = {}) {
  const haystack = normalize([property.address, property.title, ...(Array.isArray(property.tags) ? property.tags : []), property.description, property.preferredDistrict].join(' '))
  const match = DISTRICT_PHOTOS.find(([district]) => haystack.includes(district) || (district === 'surco' && haystack.includes('santiago de surco')))
  return match ? match[0] : null
}

export function propertyImage(property = {}) {
  const district = detectDistrict(property)
  if (district) return DISTRICT_PHOTOS.find(([name]) => name === district)[1]
  const key = property.id || property.propertyId || property.title || property.address || ''
  return DISTRICT_PHOTOS[stableHash(key) % DISTRICT_PHOTOS.length][1]
}

export const propertyImageAlt = property => `Fotografía referencial de ${property?.title || 'inmueble'}`
