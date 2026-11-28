import { request } from '../services/http.js'
import { propertyQuery } from './model.js'

export const listProperties = (filters) => request(`/properties?${propertyQuery(filters)}`)
export const createProperty = (property) => request('/properties', { method: 'POST', body: property })
export const deleteProperty = (id) => request(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** US09: solo el propietario. Contrato real: { registryNumber, claimedOwner } → PropertyLegitimacyResponse. */
export const verifyPropertyRegistry = (id, { registryNumber, claimedOwner }) =>
  request(`/properties/${encodeURIComponent(id)}/verify-registry`, {
    method: 'POST',
    body: { registryNumber: String(registryNumber).trim(), claimedOwner: claimedOwner?.trim() || null },
  })

export const getPropertyLegitimacy = (id) =>
  request(`/properties/${encodeURIComponent(id)}/legitimacy`)

/** Estados reales de PropertyLegitimacyStatus (backend) → etiqueta y clase CSS del badge. */
const BADGES = {
  VERIFIED_GENUINE: { label: 'Verificado SUNARP', css: 'badge-verified' },
  FLAGGED_ANOMALY: { label: 'Observado SUNARP', css: 'badge-rejected' },
  PENDING_VERIFICATION: { label: 'Sin verificación registral', css: 'badge-pending' },
}

/** Acepta PropertyResponse (legitimacyStatus/certificateHash) o PropertyLegitimacyResponse (status/certificateHash). */
export function legitimacyBadge(source) {
  const status = source?.legitimacyStatus || source?.status || 'PENDING_VERIFICATION'
  const badge = BADGES[status] || BADGES.PENDING_VERIFICATION
  const hash = typeof source?.certificateHash === 'string' && /^[0-9a-f]{64}$/.test(source.certificateHash) ? source.certificateHash : null
  return { status: BADGES[status] ? status : 'PENDING_VERIFICATION', ...badge, hash, shortHash: hash ? `${hash.slice(0, 16)}…` : null, verified: status === 'VERIFIED_GENUINE' }
}
