<script setup>
import { reactive, ref } from 'vue'
import { advisorView, getAiPropertyRecommendations } from './ai-api.js'
import { formatMoney } from './model.js'
import { parseTags } from '../properties/model.js'
import { propertyImage, propertyImageAlt } from '../properties/images.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'

const dtiWidth = rec => `${Math.min(100, Math.max(0, (Number(rec.debtToIncomeRatioPercent) || 0) / 50 * 100))}%`

const form = reactive({ monthlyIncome: '6500', currency: 'PEN', downPaymentAvailable: '45000', preferredDistrict: '', desiredTermYears: 20, tags: 'terraza, estacionamiento' })
const loading = ref(false)
const error = ref('')
const view = ref(null)

async function submitAdvisor() {
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(String(form.monthlyIncome).trim()) || Number(form.monthlyIncome) < 500) {
    error.value = 'Ingresa un ingreso mensual válido de al menos 500.00.'
    return
  }
  loading.value = true
  error.value = ''
  view.value = null
  try {
    view.value = advisorView(await getAiPropertyRecommendations({
      monthlyIncome: form.monthlyIncome,
      currency: form.currency,
      downPaymentAvailable: form.downPaymentAvailable,
      preferredDistrict: form.preferredDistrict,
      desiredTermYears: form.desiredTermYears,
      preferenceTags: parseTags(form.tags),
    }))
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
      <span class="ai-icon" aria-hidden="true"><AppIcon name="sparkles" :size="22" /></span>
      <div>
        <div class="ai-title-wrap">
          <h2 id="ai-advisor-title">Asistente Hipotecario Inteligente</h2>
          <span class="pill">Motor IA SBS</span>
        </div>
        <p class="field-help">Evalúa de forma determinista tu capacidad de pago (límite 35 % SBS, TEA de referencia 9.50 %) y ordena los inmuebles del catálogo en tu moneda.</p>
      </div>
    </div>

    <form class="account-form" novalidate :aria-busy="loading" @submit.prevent="submitAdvisor">
      <fieldset :disabled="loading">
        <div class="form-grid">
          <div class="form-field"><label for="ai-income">Ingreso mensual neto</label><input id="ai-income" v-model="form.monthlyIncome" type="text" inputmode="decimal" required /></div>
          <div class="form-field"><label for="ai-currency">Moneda</label><select id="ai-currency" v-model="form.currency"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select></div>
          <div class="form-field"><label for="ai-down">Cuota inicial disponible (opcional)</label><input id="ai-down" v-model="form.downPaymentAvailable" type="text" inputmode="decimal" /></div>
          <div class="form-field"><label for="ai-term">Plazo deseado</label><select id="ai-term" v-model.number="form.desiredTermYears"><option :value="10">10 años</option><option :value="15">15 años</option><option :value="20">20 años</option><option :value="25">25 años</option><option :value="30">30 años</option></select></div>
          <div class="form-field"><label for="ai-district">Distrito preferido (opcional)</label><input id="ai-district" v-model="form.preferredDistrict" type="text" placeholder="Ej. Miraflores, San Isidro, Surco" maxlength="60" /></div>
          <div class="form-field"><label for="ai-tags">Características / etiquetas</label><input id="ai-tags" v-model="form.tags" type="text" placeholder="Ej. terraza, estacionamiento" /></div>
        </div>
        <div class="ai-actions"><button class="primary-button" type="submit"><AppIcon name="search" :size="16" />{{ loading ? 'Evaluando con IA…' : 'Buscar Inmuebles Recomendados' }}</button></div>
      </fieldset>
    </form>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <div v-if="view" class="evaluation-summary">
      <h3>Perfil Financiero Estimado (Normativa SBS)</h3>
      <dl class="metrics-grid">
        <div class="metric-highlight"><dt>Cuota máxima admisible (35 %)</dt><dd class="ai-max-installment">{{ formatMoney(view.maxAllowableInstallment, view.currency) }} / mes</dd></div>
        <div><dt>Inmuebles analizados</dt><dd>{{ view.analyzed }}</dd></div>
        <div><dt>Inmuebles viables</dt><dd>{{ view.viable }}</dd></div>
      </dl>
      <p class="field-help ai-summary">{{ view.summary }}</p>
    </div>

    <div v-if="view" class="recommendations-container">
      <h3>Inmuebles Sugeridos por Compatibilidad</h3>
      <p v-if="!view.recommendations.length" role="status">No hay inmuebles en {{ view.currency }} para evaluar. Prueba con otra moneda o registra inmuebles.</p>
      <ul v-else class="property-grid">
        <li v-for="rec in view.recommendations" :key="rec.propertyId" class="content-card recommendation-card">
          <div class="rec-photo"><img :src="propertyImage({ id: rec.propertyId, title: rec.title, address: rec.address })" :alt="propertyImageAlt({ title: rec.title, address: rec.address })" loading="lazy" width="800" height="500" /><span class="score-badge">Score: {{ rec.relevanceScore }}/100</span></div>
          <div class="rec-body">
            <span class="pill" :class="rec.financiallyViable ? 'pill-success' : 'pill-warning'">{{ rec.viabilityLabel }}</span>
            <h4 class="clamp-2" :title="rec.title">{{ rec.title }}</h4>
            <p class="rec-address"><AppIcon name="pin" :size="14" />{{ rec.address }}</p>
            <p class="property-price">{{ formatMoney(rec.price, rec.currency) }}</p>
            <dl class="rec-metrics">
              <dt>Cuota estimada</dt><dd><strong>{{ formatMoney(rec.estimatedMonthlyInstallment, rec.currency) }}</strong></dd>
              <dt>Carga financiera</dt><dd>{{ rec.ratioLabel }} del ingreso neto</dd>
            </dl>
            <div class="dti-bar" aria-hidden="true"><span class="dti-fill" :class="{ over: !rec.financiallyViable }" :style="{ width: dtiWidth(rec) }"></span><span class="dti-limit"></span></div>
            <p class="dti-scale" aria-hidden="true"><span>0 %</span><span>Límite 35 %</span><span>50 %</span></p>
            <p class="rec-reason"><AppIcon name="info" :size="14" />{{ rec.recommendationReason }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.ai-advisor-card { margin-top: 24px; border-color: var(--cc-soft-border); background: linear-gradient(180deg, #f5f9ff 0%, #fff 140px); }
.ai-header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
.ai-icon { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--cc-navy); color: #fff; }
.ai-title-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ai-title-wrap h2 { margin: 0; }
.ai-actions { margin-top: 16px; display: flex; justify-content: flex-end; }
.evaluation-summary { margin-top: 20px; padding: 16px; background: #fff; border-radius: var(--cc-radius-sm); border: 1px solid var(--cc-border); }
.evaluation-summary h3 { margin: 0; font-size: 15px; }
.metric-highlight { background: var(--cc-soft) !important; border-color: var(--cc-soft-border) !important; }
.metric-highlight dd { color: var(--cc-navy); font-size: 18px; }
.recommendations-container { margin-top: 20px; }
.recommendations-container h3 { font-size: 15px; }
.recommendation-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.rec-photo { position: relative; aspect-ratio: 16 / 10; background: #e2e8f0; }
.rec-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.score-badge { position: absolute; top: 10px; left: 10px; background: rgba(23, 75, 133, .92); color: #fff; font-weight: 700; font-size: 12.5px; padding: 4px 10px; border-radius: 999px; }
.rec-body { padding: 14px 16px 16px; display: grid; gap: 6px; }
.rec-body h4 { margin: 4px 0 0; font-size: 15.5px; }
.rec-body .pill { justify-self: start; }
.rec-address { display: flex; gap: 6px; align-items: center; color: var(--cc-text-3); font-size: 13px; margin: 0; }
.rec-metrics { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin: 4px 0 0; }
.rec-metrics dt { color: var(--cc-text-3); }
.rec-metrics dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.dti-bar { position: relative; height: 8px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin-top: 4px; }
.dti-fill { position: absolute; inset: 0 auto 0 0; background: var(--cc-blue); border-radius: 999px; }
.dti-fill.over { background: var(--cc-warning); }
.dti-limit { position: absolute; top: 0; bottom: 0; left: 70%; width: 2px; background: var(--cc-navy); }
.dti-scale { display: flex; justify-content: space-between; font-size: 11px; color: var(--cc-text-3); margin: 0; }
.dti-scale span:nth-child(2) { margin-left: 30%; }
.rec-reason { display: flex; gap: 6px; align-items: flex-start; background: var(--cc-canvas); border: 1px solid var(--cc-border); padding: 8px 10px; border-radius: 8px; font-size: 13px; color: var(--cc-text-2); margin: 4px 0 0; }
.rec-reason svg { flex: none; margin-top: 2px; }
</style>
