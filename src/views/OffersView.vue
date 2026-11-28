<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { listOffers } from '../offers/api.js'
import { formatPrice } from '../properties/model.js'
import { formatRate } from '../offers/format.js'
import { propertyImage, propertyImageAlt } from '../properties/images.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
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
    <div class="page-header">
      <div>
        <p class="eyebrow">US07 · US09 · Ofertas</p>
        <h1 id="page-title">Ofertas recibidas</h1>
        <p class="page-subtitle">Propuestas de financiamiento asociadas a los inmuebles que consultaste.</p>
      </div>
      <button type="button" class="secondary-button" :disabled="loading" @click="load()"><AppIcon name="refresh" :size="16" />Actualizar ofertas</button>
    </div>
    <p class="demo-notice"><span class="pill demo-label">DEMO</span><span>Propuestas de demostración. No representan una aprobación ni una oferta vinculante de un banco.</span></p>
    <p v-if="loading" role="status">Cargando ofertas…</p>
    <div v-else-if="error" role="alert"><p class="form-error">{{ error }}</p><button class="text-button" type="button" @click="load()">Reintentar ofertas</button></div>
    <template v-else>
      <p v-if="!data.items.length" class="empty-state" role="status">Todavía no has recibido ofertas.</p>
      <ul class="property-grid offer-grid">
        <li v-for="offer in data.items" :key="offer.id" class="content-card offer-card">
          <div class="property-photo"><img :src="propertyImage(offer.property || {})" :alt="propertyImageAlt(offer.property || {})" loading="lazy" width="800" height="500" /><div class="photo-pills"><span class="pill demo-label">DEMO</span><span class="pill">{{ offer.bankName }}</span></div></div>
          <div class="card-body">
            <h2 class="clamp-2" :title="offer.title">{{ offer.title }}</h2>
            <p class="property-address"><AppIcon name="building" :size="15" />{{ offer.property.title }}</p>
            <p class="property-price">{{ formatPrice(offer.loanAmount, offer.currency) }}</p>
            <div class="offer-facts"><span class="pill">TEA {{ formatRate(offer.annualInterestRate) }}</span><span class="pill pill-muted"><AppIcon name="calendar" :size="13" />{{ offer.termMonths }} meses</span></div>
            <div class="card-actions"><RouterLink class="primary-button" :to="`/offers/${offer.id}`">Ver oferta<AppIcon name="arrow" :size="15" /></RouterLink></div>
          </div>
        </li>
      </ul>
      <nav v-if="data.totalPages > 1" class="property-pagination" aria-label="Paginación de ofertas"><button class="secondary-button" type="button" :disabled="data.page === 0" @click="load(data.page - 1)">Anterior</button><span>Página {{ data.page + 1 }} de {{ data.totalPages }}</span><button class="secondary-button" type="button" :disabled="data.page + 1 >= data.totalPages" @click="load(data.page + 1)">Siguiente</button></nav>
    </template>
  </section>
</template>

<style scoped>
.offer-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.offer-card h2 { font-size: 16px; margin: 0; }
.offer-facts { display: flex; flex-wrap: wrap; gap: 6px; }
.offer-facts .pill { display: inline-flex; align-items: center; gap: 4px; }
</style>
