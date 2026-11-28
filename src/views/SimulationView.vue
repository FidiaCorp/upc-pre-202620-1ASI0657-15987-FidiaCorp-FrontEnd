<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
import { calculateSimulation, getSimulation } from '../simulations/api.js'
import { compoundingOptions, rateTypes, simulationDefaults, simulationPayload, validateSimulation, validUuid } from '../simulations/model.js'
import SimulationHistory from '../simulations/SimulationHistory.vue'
import ScheduleResult from '../simulations/ScheduleResult.vue'
import AiMortgageAdvisor from '../simulations/AiMortgageAdvisor.vue'
import BankRatesStatus from '../simulations/BankRatesStatus.vue'
const form = reactive(simulationDefaults())
// Prellenado opcional desde el catálogo ("Simular crédito"): solo si la URL trae los parámetros.
const route = useRoute()
const prefill = { value: route.query.propertyValue, currency: route.query.currency, title: route.query.property }
if (typeof prefill.value === 'string' && /^\d{1,16}(\.\d{1,2})?$/.test(prefill.value)) {
  form.propertyValue = prefill.value
  form.loanAmount = (Math.round(Number(prefill.value) * 80) / 100).toFixed(2)
}
if (prefill.currency === 'PEN' || prefill.currency === 'USD') form.currency = prefill.currency
const prefillTitle = typeof prefill.title === 'string' && prefill.value ? prefill.title.slice(0, 120) : ''
const errors = ref({})
const message = ref('')
const busy = ref(false)
const result = ref(null)
const recoveryId = ref('')
const recoveryError = ref('')
let disposed = false
const history = ref(null)
const fields = computed(() => [
  { key: 'loanAmount', label: 'Importe del préstamo', hint: 'Positivo. Hasta 16 enteros y 2 decimales; usa punto decimal.' },
  { key: 'propertyValue', label: 'Valor del inmueble (opcional)', hint: 'Si lo omites se utiliza el importe del préstamo.' },
  { key: 'termMonths', label: 'Plazo en meses', hint: 'De 1 a 360 meses.' },
  form.rateType === 'TNA'
    ? { key: 'teaPercent', label: 'TNA anual (%)', hint: 'Tasa nominal: el servidor la convierte a TEA con la capitalización elegida. Ejemplo: 12.' }
    : { key: 'teaPercent', label: 'TEA anual (%)', hint: 'Mayor que 0 y hasta 100 %, con hasta 6 decimales. Ejemplo: 8.5.' },
])
const advanced = [
  { key: 'lifeInsurancePercent', label: 'Seguro de desgravamen mensual (%)' },
  { key: 'propertyInsurancePercent', label: 'Seguro del inmueble mensual (%)' },
  { key: 'monthlyAdminFee', label: 'Gastos administrativos mensuales' },
  { key: 'discountPercent', label: 'COK anual (%) — opcional, cero permitido' },
]
function serverErrors(error) {
  const mapping = { annualInterestRate: 'teaPercent', compoundingPeriodsPerYear: 'compoundingPeriodsPerYear', rateType: 'rateType', lifeInsuranceRate: 'lifeInsurancePercent', propertyInsuranceRate: 'propertyInsurancePercent', discountRateAnnual: 'discountPercent' }
  return Object.fromEntries(Object.entries(error.validationErrors || {}).map(([key, value]) => [mapping[key] || key, value]))
}
async function calculate() {
  if (busy.value) return
  result.value = null
  message.value = ''
  recoveryError.value = ''
  errors.value = validateSimulation(form)
  if (Object.keys(errors.value).length) { message.value = 'Revisa los campos indicados. No se realizó la simulación.'; return }
  busy.value = true
  try { const value = await calculateSimulation(simulationPayload(form)); if (!disposed) { result.value = value; recoveryId.value = value.quotationId; history.value?.reload() } } catch (error) { if (!disposed) { errors.value = serverErrors(error); message.value = error.message } } finally { busy.value = false }
}
function openFromHistory(id) { recoveryId.value = id; recover() }
async function recover() {
  if (busy.value) return
  result.value = null
  message.value = ''
  recoveryError.value = ''
  if (!validUuid(recoveryId.value.trim())) { recoveryError.value = 'Ingresa un identificador UUID válido.'; return }
  busy.value = true
  try { const value = await getSimulation(recoveryId.value.trim()); if (!disposed) result.value = value } catch (error) { if (!disposed) recoveryError.value = error.status === 404 ? 'La simulación no existe o no pertenece a tu cuenta.' : error.message } finally { busy.value = false }
}
onUnmounted(() => { disposed = true })
</script>
<template>
  <section class="simulation-page" aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">US19 · Método francés vencido</p>
        <h1 id="page-title">Simular crédito</h1>
        <p class="page-subtitle">Calcula tu cronograma con TEA o TNA, seguros, gracia y cuota balón.</p>
        <BankRatesStatus />
      </div>
      <p class="comparator-link"><RouterLink class="secondary-button" to="/simulations/compare"><AppIcon name="compare" :size="16" />Comparar escenarios (US20)</RouterLink></p>
    </div>
    <p class="demo-notice"><AppIcon name="info" :size="18" /><span>Simulación orientativa. No representa una aprobación bancaria. El resultado incluye únicamente los seguros y cargos que indiques.</span></p>
    <p v-if="prefillTitle" class="info-notice" role="status">Valores precargados desde el inmueble «{{ prefillTitle }}»: préstamo al 80 % del valor. Ajusta los datos antes de calcular.</p>
    <div class="simulator-layout">
      <section class="content-card simulator-form-card" aria-labelledby="simulation-form-title">
        <h2 id="simulation-form-title">Datos de la simulación</h2>
        <form class="account-form" novalidate :aria-busy="busy" @submit.prevent="calculate">
          <fieldset :disabled="busy">
            <div class="form-grid">
              <div class="form-field rate-type-field"><label for="sim-rateType">Tipo de tasa (US19)</label><select id="sim-rateType" v-model="form.rateType" aria-describedby="sim-rateType-help"><option v-for="[value, label] in rateTypes" :key="value" :value="value">{{ label }}</option></select><p id="sim-rateType-help" :class="errors.rateType ? 'field-error' : 'field-help'">{{ errors.rateType || 'La TEA se usa tal cual; la TNA se convierte a TEA equivalente antes de calcular el cronograma.' }}</p></div>
              <div v-if="form.rateType === 'TNA'" class="form-field"><label for="sim-compounding">Capitalización de la TNA</label><select id="sim-compounding" v-model="form.compoundingPeriodsPerYear" :aria-invalid="Boolean(errors.compoundingPeriodsPerYear)" aria-describedby="sim-compounding-help"><option v-for="[value, label] in compoundingOptions" :key="value" :value="value">{{ label }}</option></select><p id="sim-compounding-help" :class="errors.compoundingPeriodsPerYear ? 'field-error' : 'field-help'">{{ errors.compoundingPeriodsPerYear || 'TEA = (1 + TNA/m)^m − 1, con m periodos de capitalización por año.' }}</p></div>
              <div v-for="field in fields" :key="field.key" class="form-field"><label :for="`sim-${field.key}`">{{ field.label }}</label><input :id="`sim-${field.key}`" v-model="form[field.key]" type="text" :inputmode="field.key === 'termMonths' ? 'numeric' : 'decimal'" :required="field.key !== 'propertyValue'" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="`sim-${field.key}-help`" /><p :id="`sim-${field.key}-help`" :class="errors[field.key] ? 'field-error' : 'field-help'">{{ errors[field.key] || field.hint }}</p></div>
              <div class="form-field"><label for="sim-currency">Moneda</label><select id="sim-currency" v-model="form.currency"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select><p v-if="errors.currency" class="field-error">{{ errors.currency }}</p></div>
              <div class="form-field"><label for="sim-startDate">Fecha inicial</label><input id="sim-startDate" v-model="form.startDate" type="date" min="1900-01-01" max="9990-12-31" required :aria-invalid="Boolean(errors.startDate)" aria-describedby="sim-date-help" /><p id="sim-date-help" :class="errors.startDate ? 'field-error' : 'field-help'">{{ errors.startDate || 'Se permiten fechas históricas. La última cuota debe quedar antes del año 10000.' }}</p></div>
            </div>
            <details class="simulation-advanced"><summary>Opciones avanzadas: gracia, balón, seguros y gastos</summary>
              <div class="advanced-body">
                <div class="form-grid">
                  <div class="form-field"><label for="sim-propertyAddress">Dirección referencial (opcional)</label><input id="sim-propertyAddress" v-model="form.propertyAddress" maxlength="250" /><p v-if="errors.propertyAddress" class="field-error">{{ errors.propertyAddress }}</p></div>
                  <div class="form-field"><label for="sim-gracePeriodType">Tipo de gracia</label><select id="sim-gracePeriodType" v-model="form.gracePeriodType"><option value="NONE">Sin gracia</option><option value="PARTIAL">Parcial</option><option value="TOTAL">Total</option></select></div>
                  <div v-if="form.gracePeriodType !== 'NONE'" class="form-field"><label for="sim-gracePeriodMonths">Meses de gracia</label><input id="sim-gracePeriodMonths" v-model="form.gracePeriodMonths" type="text" inputmode="numeric" /><p v-if="errors.gracePeriodMonths" class="field-error">{{ errors.gracePeriodMonths }}</p></div>
                  <div v-for="field in advanced" :key="field.key" class="form-field"><label :for="`sim-${field.key}`">{{ field.label }}</label><input :id="`sim-${field.key}`" v-model="form[field.key]" type="text" inputmode="decimal" /><p v-if="errors[field.key]" class="field-error">{{ errors[field.key] }}</p></div>
                </div>
                <label class="checkbox-label"><input v-model="form.balloon" type="checkbox" /> Añadir cuota balón al vencimiento</label>
                <div v-if="form.balloon" class="form-field balloon-field"><label for="sim-balloonPaymentAmount">Importe del balón</label><input id="sim-balloonPaymentAmount" v-model="form.balloonPaymentAmount" type="text" inputmode="decimal" /><p v-if="errors.balloonPaymentAmount" class="field-error">{{ errors.balloonPaymentAmount }}</p><p class="field-help">Se paga en el último mes y no puede superar el préstamo.</p></div>
                <p class="field-help">Seguros y gastos parten de cero. COK vacío utiliza la TEA; los porcentajes admiten hasta 6 decimales.</p>
              </div>
            </details>
            <div class="form-actions"><button class="primary-button" type="submit"><AppIcon name="calculator" :size="16" />{{ busy ? 'Procesando…' : 'Calcular simulación' }}</button></div>
          </fieldset>
          <p v-if="message" class="form-error" role="alert">{{ message }}</p>
        </form>
      </section>
      <section class="content-card simulation-recovery" aria-labelledby="recovery-title"><h2 id="recovery-title"><AppIcon name="history" :size="18" /> Recuperar simulación</h2><p class="field-help">Pega el identificador de una simulación guardada para volver a ver su cronograma.</p><form class="account-form" novalidate @submit.prevent="recover"><div class="form-field"><label for="simulation-id">Identificador de la simulación</label><input id="simulation-id" v-model="recoveryId" autocomplete="off" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" :disabled="busy" :aria-invalid="Boolean(recoveryError)" aria-describedby="recovery-error" /></div><button type="submit" class="secondary-button" :disabled="busy">Recuperar cronograma</button><p v-if="recoveryError" id="recovery-error" class="form-error" role="alert">{{ recoveryError }}</p></form></section>
    </div>
    <ScheduleResult v-if="result && !busy" :result="result" />
    <SimulationHistory ref="history" @open="openFromHistory" />
    <AiMortgageAdvisor />
  </section>
</template>

<style scoped>
.simulator-layout { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(260px, 1fr); gap: 20px; align-items: start; }
.simulator-layout > .content-card { margin: 0; }
.simulation-recovery h2 { display: flex; align-items: center; gap: 8px; }
.comparator-link { margin: 0; }
.form-actions { margin-top: 18px; display: flex; justify-content: flex-end; }
.balloon-field { max-width: 360px; }
@media (max-width: 1024px) { .simulator-layout { grid-template-columns: 1fr; } }
</style>
