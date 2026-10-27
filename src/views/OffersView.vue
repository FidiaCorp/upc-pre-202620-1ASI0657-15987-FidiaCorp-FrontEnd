<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { listOffers } from '../offers/api.js'
import { formatPrice } from '../properties/model.js'
import { formatRate } from '../offers/format.js'
const data = ref({ items: [], page: 0, totalPages: 0 })
const loading = ref(false)
const error = ref('')
let sequence = 0
let disposed = false
async function load(page = data.value.page) {
  const ownSequence = ++sequence
  loading.value = true
  error.value = ''
  try {
    const result = await listOffers({ page })
    if (!disposed && ownSequence === sequence) data.value = result
  } catch (err) { if (!disposed && ownSequence === sequence) error.value = err.message } finally { if (!disposed && ownSequence === sequence) loading.value = false }
}
onMounted(() => load())
onUnmounted(() => { disposed = true; sequence++ })
</script>
<template>
  <section aria-labelledby="page-title">
    <div class="section-heading"><h1 id="page-title">Ofertas recibidas</h1><button type="button" class="primary-button" :disabled="loading" @click="load()">Actualizar ofertas</button></div>
    <p class="demo-notice">DEMO: propuestas de demostración. No representan una aprobación ni una oferta vinculante de un banco.</p>
    <p v-if="loading" role="status">Cargando ofertas…</p>
    <div v-else-if="error" role="alert"><p class="form-error">{{ error }}</p><button class="text-button" type="button" @click="load()">Reintentar ofertas</button></div>
    <template v-else>
      <p v-if="!data.items.length" role="status">Todavía no has recibido ofertas.</p>
      <ul class="property-grid"><li v-for="offer in data.items" :key="offer.id" class="content-card property-card"><span class="demo-label">DEMO</span><h2>{{ offer.title }}</h2><p>{{ offer.bankName }}</p><p>{{ offer.property.title }}</p><p>{{ formatPrice(offer.loanAmount, offer.currency) }}</p><p>Tasa efectiva anual: {{ formatRate(offer.annualInterestRate) }}</p><p>{{ offer.termMonths }} meses</p><RouterLink class="text-link" :to="`/offers/${offer.id}`">Ver oferta</RouterLink></li></ul>
      <nav v-if="data.totalPages > 1" class="property-pagination" aria-label="Paginación de ofertas"><button class="primary-button" type="button" :disabled="data.page === 0" @click="load(data.page - 1)">Anterior</button><span>Página {{ data.page + 1 }} de {{ data.totalPages }}</span><button class="primary-button" type="button" :disabled="data.page + 1 >= data.totalPages" @click="load(data.page + 1)">Siguiente</button></nav>
    </template>
  </section>
</template>
