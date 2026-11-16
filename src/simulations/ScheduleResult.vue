<script setup>
import { ref } from 'vue'
import { formatDate, formatRate } from '../offers/format.js'
import { formatMoney, installmentFields, moneyMetrics, rateMetrics } from './model.js'
import { downloadSimulationXlsx } from './api.js'

const props = defineProps({ result: { type: Object, required: true } })

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
  <section class="schedule-result" aria-labelledby="schedule-title">
    <div class="schedule-header">
      <h2 id="schedule-title">Cronograma de pagos</h2>
      <button
        v-if="result.quotationId"
        class="primary-button export-xlsx-btn"
        type="button"
        :disabled="downloading"
        @click="handleExportXlsx"
      >
        {{ downloading ? 'Generando XLSX…' : 'Descargar cronograma (.xlsx)' }}
      </button>
    </div>
    <p v-if="downloadError" class="form-error" role="alert">{{ downloadError }}</p>
    <p>Identificador para recuperar: <code class="quotation-id">{{ result.quotationId }}</code></p>
    <dl class="offer-details"><dt>Préstamo</dt><dd>{{ formatMoney(result.loanAmount, result.currency) }}</dd><dt>Valor del inmueble</dt><dd>{{ formatMoney(result.propertyValue, result.currency) }}</dd><dt>Plazo</dt><dd>{{ result.termMonths }} meses</dd><dt>Cuota mensual ordinaria estimada</dt><dd>{{ formatMoney(result.estimatedMonthlyInstallment, result.currency) }}</dd></dl>
    <h3>Métricas financieras</h3>
    <p v-if="result.schedule.some(row => row.graceType === 'TOTAL')" class="field-help">La gracia total capitaliza intereses: la amortización total los incluye y se solapa con los intereses devengados. El costo total corresponde a los pagos calculados por el servidor; estas métricas no son un desglose aditivo.</p>
    <dl class="metrics-grid"><template v-for="[key, label] in rateMetrics" :key="key"><dt>{{ label }}</dt><dd>{{ formatRate(result.metrics[key]) }}</dd></template><template v-for="[key, label] in moneyMetrics" :key="key"><dt>{{ label }}</dt><dd>{{ formatMoney(result.metrics[key], result.currency) }}</dd></template></dl>
    <p id="schedule-help" class="field-help">Desplaza la tabla horizontalmente para consultar todas las columnas. Se muestran las {{ result.termMonths }} cuotas persistidas.</p>
    <div class="schedule-table-wrapper" tabindex="0" role="region" aria-label="Tabla de cuotas" aria-describedby="schedule-help">
      <table class="schedule-table"><caption>Detalle completo de cuotas en {{ result.currency }}</caption><thead><tr><th scope="col">Cuota</th><th scope="col">Vencimiento</th><th v-for="[key, label] in installmentFields" :key="key" scope="col">{{ label }}</th><th scope="col">Gracia</th></tr></thead><tbody><tr v-for="row in result.schedule" :key="row.installmentNumber"><th scope="row">{{ row.installmentNumber }}</th><td>{{ formatDate(row.dueDate) }}</td><td v-for="[key] in installmentFields" :key="key">{{ formatMoney(row[key], result.currency) }}</td><td>{{ { NONE: 'Sin gracia', PARTIAL: 'Parcial', TOTAL: 'Total' }[row.graceType] }}</td></tr></tbody></table>
    </div>
  </section>
</template>

<style scoped>
.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.export-xlsx-btn {
  font-size: 0.85rem;
  padding: 0.4rem 0.8rem;
}
</style>
