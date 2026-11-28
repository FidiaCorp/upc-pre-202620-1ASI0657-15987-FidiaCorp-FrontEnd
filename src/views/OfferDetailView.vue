<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import OfferSchedule from '../simulations/OfferSchedule.vue'
import QuotationVersions from '../offers/QuotationVersions.vue'
import { getOffer } from '../offers/api.js'
import { formatPrice } from '../properties/model.js'
import { formatDate, formatRate } from '../offers/format.js'
import { propertyImage, propertyImageAlt } from '../properties/images.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
const route = useRoute()
const offer = ref(null)
const loading = ref(false)
const error = ref('')
let sequence = 0
let disposed = false
async function load() {
  const current = ++sequence
  loading.value = true
  offer.value = null
  error.value = ''
  try { const result = await getOffer(route.params.id); if (!disposed && current === sequence) offer.value = result } catch (err) { if (!disposed && current === sequence) error.value = err.status === 404 ? 'La oferta no existe o no está disponible para tu cuenta.' : err.message } finally { if (!disposed && current === sequence) loading.value = false }
}
watch(() => route.params.id, load, { immediate: true })
onUnmounted(() => { disposed = true; sequence++ })
</script>
<template>
  <section class="offer-detail-page" aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">US09 · US21 · US22</p>
        <h1 id="page-title">Detalle de oferta</h1>
        <p v-if="offer" class="page-subtitle">{{ offer.title }} · {{ offer.bankName }}</p>
      </div>
      <RouterLink class="secondary-button" to="/offers"><AppIcon name="layers" :size="16" />Volver a ofertas recibidas</RouterLink>
    </div>
    <p class="demo-notice"><span class="pill demo-label">DEMO</span><span>Propuesta de demostración. No es una aprobación bancaria ni una oferta vinculante.</span></p>
    <p v-if="loading" role="status">Cargando oferta…</p>
    <div v-else-if="error" class="content-card" role="alert"><p class="form-error">{{ error }}</p><button class="text-button" type="button" @click="load">Reintentar oferta</button></div>
    <template v-else-if="offer">
      <div class="offer-summary-grid">
        <section class="content-card offer-terms" aria-labelledby="offer-terms-title">
          <h2 id="offer-terms-title">{{ offer.title }}</h2>
          <div class="kpi-grid offer-kpis">
            <div class="kpi-card kpi-blue"><span class="kpi-label"><AppIcon name="wallet" :size="16" />Importe del crédito</span><span class="kpi-value">{{ formatPrice(offer.loanAmount, offer.currency) }}</span></div>
            <div class="kpi-card kpi-sky"><span class="kpi-label"><AppIcon name="percent" :size="16" />Tasa efectiva anual</span><span class="kpi-value">{{ formatRate(offer.annualInterestRate) }}</span></div>
            <div class="kpi-card kpi-indigo"><span class="kpi-label"><AppIcon name="calendar" :size="16" />Plazo</span><span class="kpi-value">{{ offer.termMonths }} meses</span></div>
          </div>
          <dl class="offer-details"><dt>Banco de referencia</dt><dd>{{ offer.bankName }}</dd><dt>Inmueble</dt><dd>{{ offer.property.title }} — {{ offer.property.address }}</dd><dt>Precio del inmueble al emitir</dt><dd>{{ formatPrice(offer.property.price, offer.property.currency) }}</dd><dt>Importe del crédito</dt><dd>{{ formatPrice(offer.loanAmount, offer.currency) }}</dd><dt>Tasa efectiva anual</dt><dd>{{ formatRate(offer.annualInterestRate) }}</dd><dt>Plazo</dt><dd>{{ offer.termMonths }} meses</dd><dt>Fecha inicial</dt><dd>{{ formatDate(offer.startDate) }}</dd><dt>Registrada el</dt><dd>{{ formatDate(offer.createdAt) }}</dd></dl>
        </section>
        <aside class="content-card property-snapshot" aria-labelledby="snapshot-title">
          <div class="property-photo"><img :src="propertyImage(offer.property)" :alt="propertyImageAlt(offer.property)" width="800" height="500" /><div class="photo-pills"><span class="pill">Snapshot al emitir</span></div></div>
          <div class="card-body">
            <h2 id="snapshot-title">{{ offer.property.title }}</h2>
            <p class="property-address"><AppIcon name="pin" :size="15" />{{ offer.property.address }}</p>
            <p class="property-price">{{ formatPrice(offer.property.price, offer.property.currency) }}</p>
            <p class="field-help">Los términos y el precio quedan congelados en cada versión con huella SHA-256.</p>
          </div>
        </aside>
      </div>
      <section class="content-card"><OfferSchedule :offer-id="offer.id" /></section>
      <section class="content-card"><QuotationVersions :offer-id="offer.id" /></section>
    </template>
  </section>
</template>

<style scoped>
.offer-summary-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
.offer-summary-grid > .content-card { margin: 0; }
.offer-terms h2 { margin-top: 0; }
.offer-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 8px; }
.property-snapshot { padding: 0; overflow: hidden; }
.property-snapshot h2 { font-size: 16px; margin: 0; }
.offer-detail-page > .content-card + .content-card { margin-top: 20px; }
@media (max-width: 1024px) { .offer-summary-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .offer-kpis { grid-template-columns: 1fr; } }
</style>
