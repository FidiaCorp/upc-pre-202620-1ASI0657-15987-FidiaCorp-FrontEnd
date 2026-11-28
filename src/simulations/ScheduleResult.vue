<script setup>
import { computed, ref } from 'vue'
import { formatDate, formatRate } from '../offers/format.js'
import { describeRateTerms, formatMoney, installmentFields, moneyMetrics, rateMetrics } from './model.js'
import { downloadSimulationXlsx } from './api.js'
import PaymentChart from './PaymentChart.vue'
import { shortRate } from './chart.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'

const props = defineProps({ result: { type: Object, required: true }, exportable: { type: Boolean, default: true } })

const rate = computed(() => describeRateTerms(props.result.rate))
const kpis = computed(() => [
  { key: 'installment', label: 'Cuota mensual', icon: 'wallet', tone: 'kpi-blue', value: formatMoney(props.result.estimatedMonthlyInstallment, props.result.currency), hint: 'Cuota ordinaria estimada' },
  { key: 'tcea', label: 'TCEA', icon: 'percent', tone: 'kpi-sky', value: shortRate(props.result.metrics?.tcea), exact: formatRate(props.result.metrics?.tcea), hint: 'Costo efectivo anual con cargos' },
  { key: 'van', label: 'VAN', icon: 'chart', tone: 'kpi-indigo', value: formatMoney(props.result.metrics?.van, props.result.currency), hint: 'Valor actual neto al COK' },
  { key: 'tir', label: 'TIR mensual', icon: 'refresh', tone: 'kpi-green', value: shortRate(props.result.metrics?.monthlyTir, 6), exact: formatRate(props.result.metrics?.monthlyTir), hint: 'Tasa interna de retorno' },
])
const lastIndex = computed(() => props.result.schedule.length - 1)
const downloading = ref(false)
const downloadError = ref('')

async function handleExportXlsx() {
  if (!props.result.quotationId) return
  downloading.value = true
  downloadError.value = ''
  try {
    await downloadSimulationXlsx(props.result.quotationId)
  } catch (err) {
    downloadError.value = err.message || 'No se pudo descargar el archivo Excel.'
  } finally {
    downloading.value = false
  }
}
</script>
<template>
  <section class="schedule-result content-card" aria-labelledby="schedule-title">
    <div class="schedule-header">
      <div>
        <p class="eyebrow">Resultado · Método francés</p>
        <h2 id="schedule-title">Cronograma de pagos</h2>
        <p class="quotation-ref">Identificador para recuperar: <code class="quotation-id">{{ result.quotationId }}</code></p>
      </div>
      <button v-if="exportable && result.quotationId" class="primary-button export-xlsx-btn" type="button" :disabled="downloading" @click="handleExportXlsx"><AppIcon name="download" :size="16" />{{ downloading ? 'Generando XLSX…' : 'Descargar cronograma (.xlsx)' }}</button>
    </div>
    <p v-if="downloadError" class="form-error" role="alert">{{ downloadError }}</p>
    <ul class="kpi-grid result-kpis" aria-label="Indicadores principales">
      <li v-for="kpi in kpis" :key="kpi.key" class="kpi-card" :class="kpi.tone"><span class="kpi-label"><AppIcon :name="kpi.icon" :size="16" />{{ kpi.label }}</span><span class="kpi-value" :title="kpi.exact">{{ kpi.value }}</span><span class="kpi-hint">{{ kpi.hint }}</span></li>
    </ul>
    <div class="rate-badges" aria-label="Tasas efectivas">
      <span class="pill" :title="formatRate(result.metrics?.tea)">TEA {{ shortRate(result.metrics?.tea, 6) }}</span>
      <span class="pill" :title="formatRate(result.metrics?.tem)">TEM {{ shortRate(result.metrics?.tem, 6) }}</span>
      <span class="pill pill-muted">{{ result.termMonths }} cuotas · {{ result.currency }}</span>
    </div>
    <dl class="offer-details result-terms"><div><dt>Préstamo</dt><dd>{{ formatMoney(result.loanAmount, result.currency) }}</dd></div><div><dt>Valor del inmueble</dt><dd>{{ formatMoney(result.propertyValue, result.currency) }}</dd></div><div><dt>Plazo</dt><dd>{{ result.termMonths }} meses</dd></div><div><dt>Cuota mensual ordinaria estimada</dt><dd>{{ formatMoney(result.estimatedMonthlyInstallment, result.currency) }}</dd></div><template v-if="rate"><div><dt>Tasa ingresada</dt><dd class="rate-input">{{ rate.type }} {{ formatRate(rate.input) }}<template v-if="rate.periods"> · capitalización {{ rate.periods }}/año</template></dd></div><div><dt>TEA equivalente usada</dt><dd class="rate-effective">{{ formatRate(rate.effective) }}</dd></div></template></dl>
    <PaymentChart :schedule="result.schedule" :currency="result.currency" />
    <h3 class="metrics-title">Métricas financieras</h3>
    <p v-if="result.schedule.some(row => row.graceType === 'TOTAL')" class="field-help">La gracia total capitaliza intereses: la amortización total los incluye y se solapa con los intereses devengados. El costo total corresponde a los pagos calculados por el servidor; estas métricas no son un desglose aditivo.</p>
    <dl class="metrics-grid"><div v-for="[key, label] in rateMetrics" :key="key"><dt>{{ label }}</dt><dd :title="formatRate(result.metrics[key])">{{ shortRate(result.metrics[key], 6) }}</dd></div><div v-for="[key, label] in moneyMetrics" :key="key" :class="{ 'metric-total': key === 'totalCost' }"><dt>{{ label }}</dt><dd>{{ formatMoney(result.metrics[key], result.currency) }}</dd></div></dl>
    <p id="schedule-help" class="field-help">Desplaza la tabla para consultar todas las columnas. Se muestran las {{ result.termMonths }} cuotas persistidas; la última cuota se resalta en verde.</p>
    <div class="schedule-table-wrapper" tabindex="0" role="region" aria-label="Tabla de cuotas" aria-describedby="schedule-help">
      <table class="schedule-table"><caption>Detalle completo de cuotas en {{ result.currency }}</caption><thead><tr><th scope="col">Cuota</th><th scope="col">Vencimiento</th><th v-for="[key, label] in installmentFields" :key="key" scope="col">{{ label }}</th><th scope="col">Gracia</th></tr></thead><tbody><tr v-for="(row, index) in result.schedule" :key="row.installmentNumber" :class="{ 'last-installment': index === lastIndex }"><th scope="row">{{ row.installmentNumber }}</th><td>{{ formatDate(row.dueDate) }}</td><td v-for="[key] in installmentFields" :key="key" :class="{ 'final-balance': key === 'finalBalance' }">{{ formatMoney(row[key], result.currency) }}</td><td>{{ { NONE: 'Sin gracia', PARTIAL: 'Parcial', TOTAL: 'Total' }[row.graceType] }}</td></tr></tbody></table>
    </div>
  </section>
</template>

<style scoped>
.schedule-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.schedule-header h2 { margin: 0; }
.quotation-ref { margin: 6px 0 0; font-size: 13px; color: var(--cc-text-2); }
.quotation-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--cc-soft); color: var(--cc-navy); border: 1px solid var(--cc-soft-border); border-radius: 6px; padding: 2px 6px; overflow-wrap: anywhere; }
.result-kpis { list-style: none; margin: 0; padding: 0; }
.rate-badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
.result-terms { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 10px 18px; margin: 14px 0 0; padding: 14px 16px; background: var(--cc-canvas); border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); }
.result-terms dt { font-size: 12px; font-weight: 600; color: var(--cc-text-3); }
.result-terms dd { margin: 2px 0 0; font-weight: 650; font-variant-numeric: tabular-nums; }
.metrics-title { margin: 22px 0 0; font-size: 15px; }
.metric-total { background: var(--cc-soft) !important; border-color: var(--cc-soft-border) !important; }
</style>
