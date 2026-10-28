<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import OfferSchedule from '../simulations/OfferSchedule.vue'
import { getOffer } from '../offers/api.js'
import { formatPrice } from '../properties/model.js'
import { formatDate, formatRate } from '../offers/format.js'
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
  <section class="content-card" aria-labelledby="page-title">
    <h1 id="page-title">Detalle de oferta</h1>
    <p class="demo-notice">DEMO: propuesta de demostración. No es una aprobación bancaria ni una oferta vinculante.</p>
    <p v-if="loading" role="status">Cargando oferta…</p>
    <div v-else-if="error" role="alert"><p class="form-error">{{ error }}</p><button class="text-button" type="button" @click="load">Reintentar oferta</button></div>
    <template v-else-if="offer">
      <h2>{{ offer.title }}</h2>
      <dl class="offer-details"><dt>Banco de referencia</dt><dd>{{ offer.bankName }}</dd><dt>Inmueble</dt><dd>{{ offer.property.title }} — {{ offer.property.address }}</dd><dt>Precio del inmueble al emitir</dt><dd>{{ formatPrice(offer.property.price, offer.property.currency) }}</dd><dt>Importe del crédito</dt><dd>{{ formatPrice(offer.loanAmount, offer.currency) }}</dd><dt>Tasa efectiva anual</dt><dd>{{ formatRate(offer.annualInterestRate) }}</dd><dt>Plazo</dt><dd>{{ offer.termMonths }} meses</dd><dt>Fecha inicial</dt><dd>{{ formatDate(offer.startDate) }}</dd><dt>Registrada el</dt><dd>{{ formatDate(offer.createdAt) }}</dd></dl>
      <OfferSchedule :offer-id="offer.id" />
    </template>
    <RouterLink class="text-link" to="/offers">Volver a ofertas recibidas</RouterLink>
  </section>
</template>
