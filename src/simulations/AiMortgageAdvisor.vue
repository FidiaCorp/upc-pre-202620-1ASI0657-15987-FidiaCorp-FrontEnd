<script setup>
import { reactive, ref } from 'vue'
import { getAiPropertyRecommendations } from './ai-api.js'
import { formatMoney } from './model.js'
import { parseTags } from '../properties/model.js'

const form = reactive({
  monthlyIncome: '6500',
  currency: 'PEN',
  downPayment: '45000',
  preferredDistrict: '',
  maxLoanTermMonths: 240,
  tags: 'terraza, estacionamiento',
})

const loading = ref(false)
const error = ref('')
const evaluation = ref(null)
const recommendations = ref([])
const evaluated = ref(false)

async function submitAdvisor() {
  if (!form.monthlyIncome || Number(form.monthlyIncome) <= 0) {
    error.value = 'Ingresa un monto de ingreso mensual válido mayor a cero.'
    return
  }
  loading.value = true
  error.value = ''
  evaluated.value = false
  try {
    const res = await getAiPropertyRecommendations({
      monthlyIncome: form.monthlyIncome,
      currency: form.currency,
      downPayment: form.downPayment || '0',
      preferredDistrict: form.preferredDistrict,
      maxLoanTermMonths: form.maxLoanTermMonths,
      preferredTags: parseTags(form.tags),
    })
    evaluation.value = res.borrowerEvaluation
    recommendations.value = res.recommendations || []
    evaluated.value = true
  } catch (err) {
    error.value = err.message || 'Error al consultar el Asistente Hipotecario IA.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="content-card ai-advisor-card" aria-labelledby="ai-advisor-title">
    <div class="ai-header">
      <div class="ai-title-wrap">
        <span class="ai-chip">Motor IA SBS</span>
        <h2 id="ai-advisor-title">Asistente Hipotecario Inteligente</h2>
      </div>
      <p class="field-help">
        Analiza determinísticamente tu capacidad financiera (ratio 35% SBS) y busca los inmuebles óptimos que calzan con tu presupuesto y preferencias.
      </p>
    </div>

    <form class="account-form" novalidate :aria-busy="loading" @submit.prevent="submitAdvisor">
      <fieldset :disabled="loading">
        <div class="advisor-form-grid">
          <div class="form-field">
            <label for="ai-income">Ingreso Mensual Neto</label>
            <input id="ai-income" v-model="form.monthlyIncome" type="number" step="0.01" min="100" required />
          </div>
          <div class="form-field">
            <label for="ai-currency">Moneda</label>
            <select id="ai-currency" v-model="form.currency">
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div class="form-field">
            <label for="ai-down">Cuota Inicial Disponible</label>
            <input id="ai-down" v-model="form.downPayment" type="number" step="0.01" min="0" />
          </div>
          <div class="form-field">
            <label for="ai-term">Plazo Máximo Deseado</label>
            <select id="ai-term" v-model="form.maxLoanTermMonths">
              <option :value="120">10 años (120 meses)</option>
              <option :value="180">15 años (180 meses)</option>
              <option :value="240">20 años (240 meses)</option>
              <option :value="300">25 años (300 meses)</option>
              <option :value="360">30 años (360 meses)</option>
            </select>
          </div>
          <div class="form-field">
            <label for="ai-district">Distrito Preferido (opcional)</label>
            <input id="ai-district" v-model="form.preferredDistrict" type="text" placeholder="Ej. Miraflores, San Isidro, Surco" maxlength="60" />
          </div>
          <div class="form-field">
            <label for="ai-tags">Características / Etiquetas</label>
            <input id="ai-tags" v-model="form.tags" type="text" placeholder="Ej. terraza, estacionamiento, balcón" />
          </div>
        </div>

        <button class="primary-button" type="submit">
          {{ loading ? 'Evaluando con IA…' : 'Buscar Inmuebles Recomendados' }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <!-- Resumen de Evaluación Financiera -->
    <div v-if="evaluated && evaluation" class="evaluation-summary">
      <h3>Perfil Financiero Estimado (Normativa SBS)</h3>
      <dl class="metrics-grid">
        <dt>Cuota Máxima Admisible (35%)</dt>
        <dd>{{ formatMoney(evaluation.maxAffordableMonthlyInstallment, evaluation.currency) }} / mes</dd>
        <dt>Capacidad de Financiamiento</dt>
        <dd>{{ formatMoney(evaluation.maxLoanCapacity, evaluation.currency) }}</dd>
        <dt>Presupuesto Máximo Inmueble</dt>
        <dd>{{ formatMoney(evaluation.maxPropertyPrice, evaluation.currency) }}</dd>
        <dt>Relación Cuota / Ingreso</dt>
        <dd>{{ evaluation.debtToIncomeRatioPercent }}</dd>
      </dl>
    </div>

    <!-- Lista de Inmuebles Recomendados -->
    <div v-if="evaluated" class="recommendations-container">
      <h3>Inmuebles Sugeridos por Compatibilidad</h3>
      <p v-if="!recommendations.length" role="status">
        No se encontraron inmuebles registrados que cumplan simultáneamente con tu cuota máxima admisible y filtros actuales. Prueba ampliando el plazo o aumentando la cuota inicial.
      </p>

      <ul v-else class="property-grid">
        <li v-for="rec in recommendations" :key="rec.propertyId" class="content-card recommendation-card">
          <div class="rec-score-header">
            <span class="score-badge">Score: {{ rec.recommendationScore }}/100</span>
            <span v-if="rec.legitimacyStatus === 'VERIFIED'" class="verified-tag">✓ SUNARP Verificado</span>
          </div>
          <h4>{{ rec.title }}</h4>
          <p class="rec-address">{{ rec.address }} ({{ rec.district }})</p>
          <p class="property-price">{{ formatMoney(rec.price, rec.currency) }}</p>

          <dl class="rec-metrics">
            <dt>Cuota estimada:</dt>
            <dd><strong>{{ formatMoney(rec.estimatedMonthlyInstallment, rec.currency) }}</strong></dd>
            <dt>Carga financiera:</dt>
            <dd>{{ rec.debtRatioPercent }} del ingreso neto</dd>
          </dl>

          <p class="rec-reason">💡 {{ rec.recommendationReason }}</p>

          <ul v-if="rec.tags?.length" class="tag-list">
            <li v-for="tag in rec.tags" :key="tag">{{ tag }}</li>
          </ul>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.ai-advisor-card {
  margin-top: 2rem;
  border: 1px solid #c7d2fe;
  background: #f8fafc;
  border-radius: 8px;
  padding: 1.5rem;
}
.ai-header {
  margin-bottom: 1.5rem;
}
.ai-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.ai-chip {
  background: #4f46e5;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  text-transform: uppercase;
}
.advisor-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.evaluation-summary {
  margin-top: 1.5rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.recommendations-container {
  margin-top: 1.5rem;
}
.recommendation-card {
  border-left: 4px solid #4f46e5;
  background: white;
}
.rec-score-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.score-badge {
  background: #e0e7ff;
  color: #3730a3;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.verified-tag {
  color: #166534;
  font-size: 0.8rem;
  font-weight: 600;
}
.rec-address {
  color: #64748b;
  font-size: 0.9rem;
}
.rec-metrics {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.25rem 0.75rem;
  font-size: 0.85rem;
  margin: 0.5rem 0;
}
.rec-reason {
  background: #f1f5f9;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #334155;
  margin: 0.5rem 0;
}
</style>
