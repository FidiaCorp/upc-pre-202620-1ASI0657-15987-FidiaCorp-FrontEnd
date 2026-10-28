<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { generateOfferSchedule, getOfferSchedule } from './api.js'
import ScheduleResult from './ScheduleResult.vue'
const props = defineProps({ offerId: { type: String, required: true } })
const result = ref(null)
const busy = ref(false)
const error = ref('')
const missing = ref(false)
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
watch(() => props.offerId, () => load(), { immediate: true })
onUnmounted(() => { disposed = true; sequence++ })
</script>
<template>
  <section class="offer-schedule" aria-labelledby="offer-schedule-title">
    <h2 id="offer-schedule-title">Cronograma de esta oferta</h2>
    <p class="demo-notice">DEMO: se utilizan los términos registrados al emitir esta oferta. No puedes modificarlos aquí. Sin gracia, balón, seguros ni gastos adicionales.</p>
    <p v-if="busy" role="status">Consultando el cronograma de la oferta…</p>
    <p v-if="missing" role="status">Todavía no hay un cronograma disponible para esta oferta. Puedes generarlo con sus términos fijos.</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="property-actions"><button v-if="!result" class="primary-button" type="button" :disabled="busy" @click="load(true)">Generar o recuperar cronograma de oferta</button><button class="text-button" type="button" :disabled="busy" @click="load()">Consultar cronograma de oferta</button></div>
    <ScheduleResult v-if="result && !busy" :result="result" />
  </section>
</template>
