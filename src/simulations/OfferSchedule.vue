<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { downloadOfferScheduleXlsx, generateOfferSchedule, getOfferSchedule } from './api.js'
import { downloadVersionExport } from '../offers/versions.js'
import ScheduleResult from './ScheduleResult.vue'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
const props = defineProps({ offerId: { type: String, required: true } })
const result = ref(null)
const busy = ref(false)
const error = ref('')
const missing = ref(false)
const exporting = ref(false)
const exportError = ref('')
let sequence = 0
let disposed = false
async function load(generate = false) {
  if (generate && busy.value) return
  const ownSequence = ++sequence
  busy.value = true
  result.value = null
  error.value = ''
  missing.value = false
  try {
    const value = await (generate ? generateOfferSchedule(props.offerId) : getOfferSchedule(props.offerId))
    if (!disposed && ownSequence === sequence) result.value = value
  } catch (err) {
    if (disposed || ownSequence !== sequence) return
    if (err.status === 404 && !generate) missing.value = true
    else error.value = err.status === 404 ? 'La oferta no está disponible para tu cuenta.' : err.message
  } finally { if (!disposed && ownSequence === sequence) busy.value = false }
}
async function exportXlsx() {
  if (exporting.value) return
  exporting.value = 'xlsx'
  exportError.value = ''
  try { await downloadOfferScheduleXlsx(props.offerId) } catch (err) { if (!disposed) exportError.value = err.message || 'No se pudo descargar el archivo Excel.' } finally { if (!disposed) exporting.value = false }
}
// US22: PDF generado en el servidor (OpenPDF) desde el snapshot de la última versión.
async function exportPdf() {
  if (exporting.value) return
  exporting.value = 'pdf'
  exportError.value = ''
  try { await downloadVersionExport(props.offerId, 'pdf') } catch (err) { if (!disposed) exportError.value = err.message || 'No se pudo descargar el PDF.' } finally { if (!disposed) exporting.value = false }
}
watch(() => props.offerId, () => load(), { immediate: true })
onUnmounted(() => { disposed = true; sequence++ })
</script>
<template>
  <section class="offer-schedule" aria-labelledby="offer-schedule-title">
    <div class="offer-schedule-header"><h2 id="offer-schedule-title">Cronograma de esta oferta</h2><div class="property-actions export-actions"><button v-if="result && !busy" class="secondary-button export-offer-xlsx" type="button" :disabled="Boolean(exporting)" @click="exportXlsx"><AppIcon name="download" :size="16" />{{ exporting === 'xlsx' ? 'Generando XLSX…' : 'Exportar XLSX' }}</button><button v-if="result && !busy" class="primary-button export-offer-pdf" type="button" :disabled="Boolean(exporting)" @click="exportPdf"><AppIcon name="file" :size="16" />{{ exporting === 'pdf' ? 'Generando PDF…' : 'Exportar PDF' }}</button></div></div>
    <p class="demo-notice"><span class="pill demo-label">DEMO</span><span>Se utilizan los términos registrados al emitir esta oferta. No puedes modificarlos aquí. Sin gracia, balón, seguros ni gastos adicionales.</span></p>
    <p v-if="busy" role="status">Consultando el cronograma de la oferta…</p>
    <p v-if="missing" role="status">Todavía no hay un cronograma disponible para esta oferta. Puedes generarlo con sus términos fijos.</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="property-actions"><button v-if="!result" class="primary-button" type="button" :disabled="busy" @click="load(true)">Generar o recuperar cronograma de oferta</button><button class="secondary-button" type="button" :disabled="busy" @click="load()">Consultar cronograma de oferta</button></div>
    <p v-if="exportError" class="form-error" role="alert">{{ exportError }}</p>
    <ScheduleResult v-if="result && !busy" :result="result" :exportable="false" />
  </section>
</template>

<style scoped>
.offer-schedule-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.offer-schedule-header h2 { margin: 0; }
.export-actions { margin: 0; }
.offer-schedule :deep(.schedule-result) { border: 0; box-shadow: none; padding: 0; margin-top: 16px; }
</style>
