<script setup>
// US20: comparador lado a lado de 2 a 3 escenarios (POST /simulations/compare), con prepago extraordinario opcional.
import { computed, onUnmounted, reactive, ref } from 'vue'
import { shortRate } from '../simulations/chart.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
import { formatRate } from '../offers/format.js'
import { compoundingOptions, formatMoney, rateTypes } from '../simulations/model.js'
import { compareScenarios, comparisonCriteria, comparisonMetrics, comparisonPayload, prepaymentStrategies, scenarioDefaults, validateScenarios, winsByLabel } from '../simulations/scenarios.js'
const common = reactive({ currency: 'PEN', propertyValue: '', startDate: new Date().toISOString().slice(0, 10), discountPercent: '' })
const scenarios = reactive([scenarioDefaults(0), scenarioDefaults(1)])
const errors = ref({ common: {}, scenarios: [{}, {}] })
const message = ref('')
const busy = ref(false)
const comparison = ref(null)
const wins = ref({})
// Escenario con más criterios ganados: se marca como "Mejor opción" (solo visual).
const bestOverall = computed(() => {
  if (!comparison.value) return null
  let best = null, max = 0
  for (const scenario of comparison.value.scenarios || []) {
    const count = wins.value[scenario.label]?.length || 0
    if (count > max) { max = count; best = scenario.label }
  }
  return best
})
let disposed = false
function addScenario() { if (scenarios.length < 3) { scenarios.push(scenarioDefaults(scenarios.length)); errors.value.scenarios.push({}) } }
function removeScenario(index) { if (scenarios.length > 2) { scenarios.splice(index, 1); errors.value.scenarios.splice(index, 1) } }
const display = (scenario, [key, , kind]) => scenario[key] === null || scenario[key] === undefined ? '—' : kind === 'rate' ? shortRate(scenario[key], 6) : formatMoney(scenario[key], common.currency)
async function compare() {
  if (busy.value) return
  comparison.value = null
  message.value = ''
  const validation = validateScenarios(common, scenarios)
  errors.value = validation
  if (!validation.valid) { message.value = validation.general || 'Revisa los campos indicados. No se realizó la comparación.'; return }
  busy.value = true
  try {
    const value = await compareScenarios(comparisonPayload(common, scenarios))
    if (!disposed) { comparison.value = value; wins.value = winsByLabel(value) }
  } catch (error) { if (!disposed) message.value = error.message } finally { if (!disposed) busy.value = false }
}
onUnmounted(() => { disposed = true })
</script>
<template>
  <section class="simulation-page" aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">US20 · Comparador</p>
        <h1 id="page-title">Comparar escenarios</h1>
        <p class="page-subtitle">Contrasta de 2 a 3 alternativas de financiamiento lado a lado, con prepago opcional.</p>
      </div>
      <RouterLink class="secondary-button" to="/simulations"><AppIcon name="calculator" :size="16" />Volver a simular crédito</RouterLink>
    </div>
    <p class="demo-notice"><AppIcon name="info" :size="18" /><span>Comparación orientativa de 2 a 3 escenarios con la misma moneda. Los escenarios no se guardan en tu historial.</span></p>
    <form class="account-form" novalidate :aria-busy="busy" @submit.prevent="compare">
      <fieldset class="content-card common-card" :disabled="busy">
        <legend>Datos comunes</legend>
        <div class="form-grid common-grid">
        <div class="form-field"><label for="cmp-currency">Moneda</label><select id="cmp-currency" v-model="common.currency"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select></div>
        <div class="form-field"><label for="cmp-propertyValue">Valor del inmueble (opcional)</label><input id="cmp-propertyValue" v-model="common.propertyValue" inputmode="decimal" /><p v-if="errors.common.propertyValue" class="field-error">{{ errors.common.propertyValue }}</p></div>
        <div class="form-field"><label for="cmp-startDate">Fecha inicial</label><input id="cmp-startDate" v-model="common.startDate" type="date" /><p v-if="errors.common.startDate" class="field-error">{{ errors.common.startDate }}</p></div>
        <div class="form-field"><label for="cmp-discount">COK anual (%) — opcional</label><input id="cmp-discount" v-model="common.discountPercent" inputmode="decimal" /></div>
        </div>
      </fieldset>
      <div class="scenario-grid">
        <fieldset v-for="(scenario, index) in scenarios" :key="index" class="content-card scenario-card" :disabled="busy" :data-index="index">
          <legend><span class="scenario-number">{{ index + 1 }}</span> Escenario {{ index + 1 }}</legend>
          <div class="form-field"><label :for="`cmp-${index}-label`">Etiqueta</label><input :id="`cmp-${index}-label`" v-model="scenario.label" maxlength="60" :aria-invalid="Boolean(errors.scenarios[index]?.label)" /><p v-if="errors.scenarios[index]?.label" class="field-error">{{ errors.scenarios[index].label }}</p></div>
          <div class="form-field"><label :for="`cmp-${index}-loanAmount`">Importe del préstamo</label><input :id="`cmp-${index}-loanAmount`" v-model="scenario.loanAmount" inputmode="decimal" :aria-invalid="Boolean(errors.scenarios[index]?.loanAmount)" /><p v-if="errors.scenarios[index]?.loanAmount" class="field-error">{{ errors.scenarios[index].loanAmount }}</p></div>
          <div class="form-field"><label :for="`cmp-${index}-termMonths`">Plazo en meses</label><input :id="`cmp-${index}-termMonths`" v-model="scenario.termMonths" inputmode="numeric" /><p v-if="errors.scenarios[index]?.termMonths" class="field-error">{{ errors.scenarios[index].termMonths }}</p></div>
          <div class="form-field"><label :for="`cmp-${index}-rateType`">Tipo de tasa</label><select :id="`cmp-${index}-rateType`" v-model="scenario.rateType"><option v-for="[value, label] in rateTypes" :key="value" :value="value">{{ label }}</option></select></div>
          <div v-if="scenario.rateType === 'TNA'" class="form-field"><label :for="`cmp-${index}-compounding`">Capitalización</label><select :id="`cmp-${index}-compounding`" v-model="scenario.compoundingPeriodsPerYear"><option v-for="[value, label] in compoundingOptions" :key="value" :value="value">{{ label }}</option></select></div>
          <div class="form-field"><label :for="`cmp-${index}-rate`">{{ scenario.rateType }} anual (%)</label><input :id="`cmp-${index}-rate`" v-model="scenario.teaPercent" inputmode="decimal" :aria-invalid="Boolean(errors.scenarios[index]?.teaPercent)" /><p v-if="errors.scenarios[index]?.teaPercent" class="field-error">{{ errors.scenarios[index].teaPercent }}</p></div>
          <label class="checkbox-label"><input :id="`cmp-${index}-prepayment`" v-model="scenario.prepayment" type="checkbox" /> Incluir prepago extraordinario</label>
          <template v-if="scenario.prepayment">
            <div class="form-field"><label :for="`cmp-${index}-after`">Después de la cuota</label><input :id="`cmp-${index}-after`" v-model="scenario.afterInstallment" inputmode="numeric" /><p v-if="errors.scenarios[index]?.afterInstallment" class="field-error">{{ errors.scenarios[index].afterInstallment }}</p></div>
            <div class="form-field"><label :for="`cmp-${index}-amount`">Importe del prepago</label><input :id="`cmp-${index}-amount`" v-model="scenario.prepaymentAmount" inputmode="decimal" /><p v-if="errors.scenarios[index]?.prepaymentAmount" class="field-error">{{ errors.scenarios[index].prepaymentAmount }}</p></div>
            <div class="form-field"><label :for="`cmp-${index}-strategy`">Estrategia</label><select :id="`cmp-${index}-strategy`" v-model="scenario.strategy"><option v-for="[value, label] in prepaymentStrategies" :key="value" :value="value">{{ label }}</option></select></div>
          </template>
          <button v-if="scenarios.length > 2" class="text-button danger-text" type="button" @click="removeScenario(index)"><AppIcon name="trash" :size="14" />Quitar escenario</button>
        </fieldset>
      </div>
      <div class="property-actions compare-actions">
        <button v-if="scenarios.length < 3" class="secondary-button" type="button" :disabled="busy" @click="addScenario"><AppIcon name="plus" :size="16" />Añadir escenario</button>
        <button class="primary-button" type="submit" :disabled="busy"><AppIcon name="compare" :size="16" />{{ busy ? 'Comparando…' : 'Comparar escenarios' }}</button>
      </div>
      <p v-if="message" class="form-error" role="alert">{{ message }}</p>
    </form>
    <section v-if="comparison && !busy" class="content-card comparison-result" aria-labelledby="comparison-title">
      <h2 id="comparison-title">Resultado de la comparación</h2>
      <p class="field-help">Ganador por criterio. El escenario con más criterios ganados se marca como <strong>Mejor opción</strong>.</p>
      <ul class="best-list">
        <li v-for="[key, label] in comparisonCriteria" :key="key" :data-criterion="key"><span class="criterion-name">{{ label }}</span> <span class="best-label">{{ comparison[key] }}</span></li>
      </ul>
      <div class="schedule-table-wrapper" tabindex="0" role="region" aria-label="Comparación de escenarios">
        <table class="comparison-table">
          <thead><tr><th scope="col">Indicador</th><th v-for="scenario in comparison.scenarios" :key="scenario.label" scope="col" :class="{ best: scenario.label === bestOverall }"><span class="scenario-head">{{ scenario.label }}</span><span v-if="scenario.label === bestOverall" class="pill pill-success best-pill">Mejor opción</span></th></tr></thead>
          <tbody>
            <tr><th scope="row">Tasa ingresada</th><td v-for="scenario in comparison.scenarios" :key="scenario.label">{{ scenario.rate?.rateType }} {{ formatRate(scenario.rate?.inputRate) }}</td></tr>
            <tr><th scope="row">Plazo efectivo</th><td v-for="scenario in comparison.scenarios" :key="scenario.label" class="effective-term">{{ scenario.effectiveTermMonths }} meses</td></tr>
            <tr v-for="metric in comparisonMetrics" :key="metric[0]" :data-metric="metric[0]"><th scope="row">{{ metric[1] }}</th><td v-for="scenario in comparison.scenarios" :key="scenario.label">{{ display(scenario, metric) }}</td></tr>
            <tr><th scope="row">Gana en</th><td v-for="scenario in comparison.scenarios" :key="scenario.label" class="wins">{{ wins[scenario.label]?.join(', ') || '—' }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
<style scoped>
.common-card legend, .scenario-card legend { font-weight: 700; color: var(--cc-navy); padding: 0 6px; display: inline-flex; align-items: center; gap: 8px; }
.common-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 1100px) { .common-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .common-grid { grid-template-columns: 1fr; } }
.scenario-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 16px 0; }
.scenario-grid .scenario-card { margin: 0; border-top: 3px solid var(--cc-blue); }
.scenario-number { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: var(--cc-soft); border: 1px solid var(--cc-soft-border); font-size: 12px; }
.compare-actions { justify-content: flex-end; }
.comparison-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
.comparison-table th, .comparison-table td { padding: 10px 14px; border-bottom: 1px solid #eef2f7; text-align: left; font-variant-numeric: tabular-nums; }
.comparison-table thead th { background: #f1f5f9; color: var(--cc-text-2); font-size: 12.5px; vertical-align: bottom; }
.comparison-table thead th.best { background: var(--cc-success-bg); color: var(--cc-success); }
.comparison-table tbody th { color: var(--cc-text-2); font-weight: 600; }
.scenario-head { display: block; font-weight: 700; color: var(--cc-text); }
.best-pill { margin-top: 4px; }
.wins { font-size: 12.5px; color: var(--cc-text-2); }
.best-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 10px; margin: 12px 0 20px; padding: 0; list-style: none; }
.best-list li { border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); padding: 10px 12px; background: var(--cc-canvas); display: grid; gap: 4px; }
.criterion-name { font-size: 12px; font-weight: 600; color: var(--cc-text-3); text-transform: uppercase; letter-spacing: .03em; }
.best-label { font-weight: 700; color: var(--cc-navy); }
</style>
