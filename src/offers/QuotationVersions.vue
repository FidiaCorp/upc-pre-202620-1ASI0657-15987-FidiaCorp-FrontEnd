<script setup>
// US21: historial de versiones inmutables (SHA-256) y verificación; US22: descarga PDF/XLSX por versión e historial de exportaciones.
import { onUnmounted, reactive, ref, watch } from 'vue'
import { formatDate, formatRate } from './format.js'
import { formatMoney } from '../simulations/model.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
import { createVersion, downloadVersionExport, listExports, listVersions, shortHash, verifyVersion, versionPayload, versionStatus } from './versions.js'
const props = defineProps({ offerId: { type: String, required: true }, canIssue: { type: Boolean, default: false } })
const versions = ref([])
const exportsList = ref([])
const loading = ref(false)
const error = ref('')
const notice = ref('')
const downloading = ref('')
const verification = ref({})
const form = reactive({ loanAmount: '', ratePercent: '', termMonths: '', validityDays: '' })
const formErrors = ref({})
const issuing = ref(false)
let sequence = 0
let disposed = false
async function load() {
  const own = ++sequence
  loading.value = true
  error.value = ''
  try {
    const [found, jobs] = await Promise.all([listVersions(props.offerId), listExports(props.offerId)])
    if (!disposed && own === sequence) { versions.value = found; exportsList.value = jobs }
  } catch (err) { if (!disposed && own === sequence) error.value = err.status === 404 ? 'La oferta no está disponible para tu cuenta.' : err.message } finally { if (!disposed && own === sequence) loading.value = false }
}
async function download(version, format) {
  if (downloading.value) return
  downloading.value = `${version.versionNumber}-${format}`
  notice.value = ''
  error.value = ''
  try {
    await downloadVersionExport(props.offerId, format, version.versionNumber)
    notice.value = `Se descargó la versión ${version.versionNumber} en ${format.toUpperCase()}.`
  } catch (err) { if (!disposed) error.value = err.message || 'No se pudo descargar el archivo.' } finally {
    if (!disposed) { downloading.value = ''; try { exportsList.value = await listExports(props.offerId) } catch { /* El historial se recarga en la próxima consulta. */ } }
  }
}
async function verify(version) {
  try {
    const checked = await verifyVersion(version.id)
    if (!disposed) verification.value = { ...verification.value, [version.id]: versionStatus(checked).label }
  } catch (err) { if (!disposed) verification.value = { ...verification.value, [version.id]: err.message } }
}
async function issue() {
  if (issuing.value) return
  const { body, errors } = versionPayload(form)
  formErrors.value = errors
  if (Object.keys(errors).length) return
  issuing.value = true
  notice.value = ''
  error.value = ''
  try {
    const created = await createVersion(props.offerId, body)
    if (!disposed) { notice.value = `Se emitió la versión ${created.versionNumber}.`; Object.assign(form, { loanAmount: '', ratePercent: '', termMonths: '', validityDays: '' }); await load() }
  } catch (err) { if (!disposed) { formErrors.value = err.validationErrors || {}; error.value = err.message } } finally { if (!disposed) issuing.value = false }
}
watch(() => props.offerId, load, { immediate: true })
onUnmounted(() => { disposed = true; sequence++ })
</script>
<template>
  <section class="quotation-versions" aria-labelledby="versions-title">
    <div class="versions-header"><h2 id="versions-title"><AppIcon name="layers" :size="18" /> Versiones de la cotización</h2><span v-if="versions.length" class="pill pill-muted">{{ versions.length }} versiones</span></div>
    <p class="field-help">Cada versión congela términos y cronograma; su huella SHA-256 se recalcula en el servidor al verificar o exportar.</p>
    <p v-if="loading" role="status">Consultando versiones…</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="form-success" role="status">{{ notice }}</p>
    <ol v-if="versions.length" class="version-list" reversed>
      <li v-for="version in versions" :key="version.id" class="version-item" :data-version="version.versionNumber">
        <h3><span class="version-number" aria-hidden="true">v{{ version.versionNumber }}</span> Versión {{ version.versionNumber }} <span class="version-status" :data-tone="versionStatus(version).tone">{{ versionStatus(version).label }}</span></h3>
        <dl class="offer-details version-terms">
          <dt>Emitida</dt><dd>{{ formatDate(version.issuedAt) }}</dd>
          <dt>Vigente hasta</dt><dd>{{ formatDate(version.expiresAt) }}</dd>
          <dt>Préstamo</dt><dd>{{ formatMoney(version.loanAmount, version.currency) }}</dd>
          <dt>TEA</dt><dd>{{ formatRate(version.annualInterestRate) }}</dd>
          <dt>Plazo</dt><dd>{{ version.termMonths }} meses</dd>
          <dt>Cuota mensual</dt><dd>{{ formatMoney(version.monthlyInstallment, version.currency) }}</dd>
          <dt>TCEA</dt><dd>{{ formatRate(version.tcea) }}</dd>
          <dt>SHA-256</dt><dd class="hash-cell"><AppIcon name="hash" :size="14" /><code :title="version.snapshotHash" class="snapshot-hash">{{ shortHash(version.snapshotHash) }}</code></dd>
        </dl>
        <div class="property-actions">
          <button class="primary-button export-version-pdf" type="button" :disabled="Boolean(downloading)" @click="download(version, 'pdf')">{{ downloading === `${version.versionNumber}-pdf` ? 'Generando PDF…' : `Descargar PDF v${version.versionNumber}` }}</button>
          <button class="secondary-button export-version-xlsx" type="button" :disabled="Boolean(downloading)" @click="download(version, 'xlsx')">Descargar XLSX v{{ version.versionNumber }}</button>
          <button class="secondary-button verify-version" type="button" @click="verify(version)">Verificar integridad</button>
        </div>
        <p v-if="verification[version.id]" class="verification-result" role="status" :data-ok="verification[version.id].startsWith('Íntegra')">{{ verification[version.id] }}</p>
      </li>
    </ol>
    <p v-else-if="!loading && !error" role="status">Aún no hay versiones para esta oferta.</p>
    <form v-if="canIssue" class="account-form new-version-form content-card" novalidate @submit.prevent="issue">
      <h3>Emitir nueva versión</h3>
      <p class="field-help">Deja vacío un campo para heredarlo de la última versión.</p>
      <fieldset :disabled="issuing">
        <div class="form-grid version-form-grid">
        <div class="form-field"><label for="ver-loanAmount">Nuevo importe</label><input id="ver-loanAmount" v-model="form.loanAmount" inputmode="decimal" /><p v-if="formErrors.loanAmount" class="field-error">{{ formErrors.loanAmount }}</p></div>
        <div class="form-field"><label for="ver-ratePercent">Nueva TEA (%)</label><input id="ver-ratePercent" v-model="form.ratePercent" inputmode="decimal" /><p v-if="formErrors.ratePercent || formErrors.annualInterestRate" class="field-error">{{ formErrors.ratePercent || formErrors.annualInterestRate }}</p></div>
        <div class="form-field"><label for="ver-termMonths">Nuevo plazo (meses)</label><input id="ver-termMonths" v-model="form.termMonths" inputmode="numeric" /><p v-if="formErrors.termMonths" class="field-error">{{ formErrors.termMonths }}</p></div>
        <div class="form-field"><label for="ver-validityDays">Vigencia (días)</label><input id="ver-validityDays" v-model="form.validityDays" inputmode="numeric" /><p v-if="formErrors.validityDays" class="field-error">{{ formErrors.validityDays }}</p></div>
        </div>
        <button class="primary-button" type="submit">{{ issuing ? 'Emitiendo…' : 'Emitir versión' }}</button>
      </fieldset>
    </form>
    <section v-if="exportsList.length" class="export-history" aria-labelledby="exports-title">
      <h3 id="exports-title"><AppIcon name="download" :size="16" /> Historial de exportaciones</h3>
      <ul class="export-list">
        <li v-for="job in exportsList" :key="job.id" :data-format="job.format" :data-status="job.status">{{ job.format }} · v{{ job.versionNumber }} · {{ job.status === 'COMPLETED' ? 'Completada' : 'Fallida' }} · {{ formatDate(job.requestedAt) }}<template v-if="job.contentSha256"> · <code :title="job.contentSha256">{{ shortHash(job.contentSha256) }}</code></template></li>
      </ul>
    </section>
  </section>
</template>
<style scoped>
.versions-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.versions-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
.version-list { display: grid; gap: 16px; padding-left: 0; list-style: none; margin: 16px 0 0; }
.version-item { border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 16px 20px; background: #fff; }
.version-item:first-child { border-color: var(--cc-soft-border); box-shadow: 0 0 0 3px rgba(29, 78, 216, .06); }
.version-item h3 { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 4px; font-size: 15.5px; }
.version-number { display: inline-grid; place-items: center; min-width: 30px; height: 26px; padding: 0 8px; border-radius: 8px; background: var(--cc-navy); color: #fff; font-size: 12.5px; font-weight: 700; }
.version-status { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: var(--cc-success-bg); color: var(--cc-success); border: 1px solid var(--cc-success-border); }
.version-status[data-tone="muted"] { background: #f1f5f9; color: var(--cc-text-2); border-color: var(--cc-border); }
.version-status[data-tone="danger"] { background: var(--cc-warning-bg); color: var(--cc-warning); border-color: var(--cc-warning-border); }
.version-terms { grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr); }
@media (max-width: 720px) { .version-terms { grid-template-columns: max-content minmax(0, 1fr); } }
.hash-cell { display: flex; align-items: center; gap: 6px; color: var(--cc-text-3); }
.snapshot-hash, .export-list code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #f1f5f9; padding: 1px 6px; border-radius: 6px; color: var(--cc-navy); }
.verification-result { margin: 10px 0 0; font-weight: 600; font-size: 13.5px; color: var(--cc-text-2); }
.verification-result[data-ok="true"] { color: var(--cc-success); }
.new-version-form { margin-top: 20px; background: var(--cc-canvas); box-shadow: none; }
.new-version-form h3 { margin: 0; }
.version-form-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 900px) { .version-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .version-form-grid { grid-template-columns: 1fr; } }
.export-history { margin-top: 20px; }
.export-history h3 { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.export-list { display: grid; gap: 6px; list-style: none; padding: 0; margin: 0; }
.export-list li { position: relative; padding: 9px 12px 9px 34px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); font-size: 13px; background: #fff; font-variant-numeric: tabular-nums; }
.export-list li::before { content: ''; position: absolute; left: 12px; top: 50%; width: 10px; height: 10px; margin-top: -5px; border-radius: 3px; background: var(--cc-navy); }
.export-list li[data-format="XLSX"]::before { background: var(--cc-success); }
.export-list li[data-status="FAILED"] { border-color: var(--cc-warning-border); background: var(--cc-warning-bg); }
</style>
