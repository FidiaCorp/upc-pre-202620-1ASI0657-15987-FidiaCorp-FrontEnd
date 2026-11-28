// Sprint 4 — US21: historial de versiones inmutables de la cotización; US22: exportación PDF/XLSX desde el snapshot sellado.
import { downloadFile, request } from '../services/http.js'

const plain = /^-?\d+(?:\.\d+)?$/
const sha256 = /^[0-9a-f]{64}$/
const id = value => encodeURIComponent(value)

export const listVersions = async offerId => requireVersions(await request(`/offers/${id(offerId)}/versions`))
export const getVersion = async (offerId, versionNumber) => requireVersion(await request(`/offers/${id(offerId)}/versions/${id(versionNumber)}`))
export const verifyVersion = async versionId => requireVersion(await request(`/quotations/versions/${id(versionId)}/verify`))
export const createVersion = async (offerId, body) => requireVersion(await request(`/offers/${id(offerId)}/versions`, { method: 'POST', body }))
export const listExports = async offerId => requireExports(await request(`/offers/${id(offerId)}/exports`))

export const exportFileName = (offerId, format, versionNumber) =>
  versionNumber ? `cotizacion_oferta_${offerId}_v${versionNumber}.${format}` : `cotizacion_oferta_${offerId}.${format}`
export function downloadVersionExport(offerId, format, versionNumber) {
  if (!['pdf', 'xlsx'].includes(format)) throw new Error('Formato de exportación no soportado.')
  const query = versionNumber ? `?${new URLSearchParams({ version: versionNumber })}` : ''
  return downloadFile(`/offers/${id(offerId)}/schedule/export/${format}${query}`, exportFileName(offerId, format, versionNumber))
}

export function requireVersion(value) {
  const fail = () => { throw new Error('El servidor devolvió una versión de cotización inválida.') }
  if (!value || typeof value.id !== 'string' || !Number.isInteger(value.versionNumber) || value.versionNumber < 1 || !sha256.test(value.snapshotHash || '')) fail()
  if (!['loanAmount', 'annualInterestRate', 'monthlyInstallment', 'tcea'].every(key => typeof value[key] === 'string' && plain.test(value[key]))) fail()
  if (typeof value.intact !== 'boolean' || typeof value.expired !== 'boolean' || !['PEN', 'USD'].includes(value.currency)) fail()
  return value
}
export function requireVersions(value) {
  if (!Array.isArray(value)) throw new Error('El servidor devolvió un historial de versiones inválido.')
  const versions = value.map(requireVersion)
  if (new Set(versions.map(version => version.versionNumber)).size !== versions.length) throw new Error('Versiones duplicadas en el historial.')
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)
}
export function requireExports(value) {
  if (!Array.isArray(value) || !value.every(job => typeof job.id === 'string' && ['PDF', 'XLSX'].includes(job.format) && ['COMPLETED', 'FAILED'].includes(job.status) && Number.isInteger(job.versionNumber))) throw new Error('El servidor devolvió un historial de exportaciones inválido.')
  return value
}

/** Estado de integridad/vigencia mostrado al usuario. La integridad la recalcula el servidor (SHA-256 del snapshot canónico). */
export function versionStatus(version) {
  if (!version.intact) return { label: 'Alterada: el SHA-256 no coincide', tone: 'danger' }
  if (version.expired) return { label: 'Íntegra · vencida', tone: 'muted' }
  return { label: 'Íntegra · vigente', tone: 'ok' }
}
export const shortHash = hash => (typeof hash === 'string' && hash.length >= 16 ? `${hash.slice(0, 12)}…${hash.slice(-4)}` : '—')
export const isRealtor = user => Array.isArray(user?.roles) && user.roles.some(role => ['REALTOR', 'ROLE_REALTOR'].includes(role))

/** Formulario de nueva versión (solo el emisor). Los campos vacíos se heredan de la última versión. */
export function versionPayload(form) {
  const errors = {}
  const body = {}
  const loan = form.loanAmount.trim()
  if (loan) { if (/^\d{1,16}(?:\.\d{1,2})?$/.test(loan) && /[1-9]/.test(loan)) body.loanAmount = loan; else errors.loanAmount = 'Importe positivo con hasta 2 decimales.' }
  const rate = form.ratePercent.trim()
  if (rate) {
    if (/^\d{1,3}(?:\.\d{1,6})?$/.test(rate) && /[1-9]/.test(rate) && Number(rate) <= 100) {
      const [integer, fraction = ''] = rate.split('.')
      const digits = `${integer}${fraction}`.padStart(fraction.length + 3, '0')
      body.annualInterestRate = `${digits.slice(0, -fraction.length - 2).replace(/^0+(?=\d)/, '')}.${digits.slice(-fraction.length - 2)}`.replace(/0+$/, '').replace(/\.$/, '')
    } else errors.ratePercent = 'TEA mayor que 0 y hasta 100 %, con hasta 6 decimales.'
  }
  const term = form.termMonths.trim()
  if (term) { if (/^\d+$/.test(term) && Number(term) >= 1 && Number(term) <= 360) body.termMonths = Number(term); else errors.termMonths = 'Plazo entero de 1 a 360 meses.' }
  const validity = form.validityDays.trim()
  if (validity) { if (/^\d+$/.test(validity) && Number(validity) >= 1 && Number(validity) <= 90) body.validityDays = Number(validity); else errors.validityDays = 'Vigencia de 1 a 90 días.' }
  return { body, errors }
}
