<script setup>
// US20: historial paginado de simulaciones propias (GET /simulations), más recientes primero.
import { onMounted, onUnmounted, ref } from 'vue'
import { formatDate, formatRate } from '../offers/format.js'
import { formatMoney } from './model.js'
import { listSimulations } from './scenarios.js'
import { shortRate } from './chart.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
const emit = defineEmits(['open'])
const page = ref(null)
const current = ref(0)
const loading = ref(false)
const error = ref('')
let sequence = 0
let disposed = false
async function load(target = current.value) {
  const own = ++sequence
  loading.value = true
  error.value = ''
  try {
    const value = await listSimulations({ page: target, size: 5 })
    if (!disposed && own === sequence) { page.value = value; current.value = value.page }
  } catch (err) { if (!disposed && own === sequence) error.value = err.message } finally { if (!disposed && own === sequence) loading.value = false }
}
defineExpose({ reload: () => load(0) })
onMounted(() => load(0))
onUnmounted(() => { disposed = true; sequence++ })
</script>
<template>
  <section class="content-card simulation-history" aria-labelledby="history-title">
    <div class="history-header"><h2 id="history-title"><AppIcon name="history" :size="18" /> Mis simulaciones</h2><span v-if="page && page.items.length" class="pill pill-muted">{{ page.totalElements }} guardadas</span></div>
    <p v-if="loading" role="status">Consultando tus simulaciones…</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-else-if="page && !page.items.length" class="empty-state" role="status">Aún no tienes simulaciones guardadas.</p>
    <div v-if="page && page.items.length" class="schedule-table-wrapper" tabindex="0" role="region" aria-label="Historial de simulaciones">
      <table class="history-table">
        <caption>{{ page.totalElements }} simulaciones guardadas</caption>
        <thead><tr><th scope="col">Fecha</th><th scope="col">Préstamo</th><th scope="col">Plazo</th><th scope="col">Tasa ingresada</th><th scope="col">TEA</th><th scope="col">TCEA</th><th scope="col">Costo total</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr></thead>
        <tbody>
          <tr v-for="item in page.items" :key="item.quotationId" :data-id="item.quotationId">
            <td>{{ formatDate(item.createdAt) }}</td>
            <td class="num">{{ formatMoney(item.loanAmount, item.currency) }}</td>
            <td>{{ item.termMonths }} meses</td>
            <td>{{ item.rateType }} {{ formatRate(item.inputRate) }}</td>
            <td :title="formatRate(item.tea)">{{ shortRate(item.tea, 6) }}</td>
            <td><span class="pill" :title="formatRate(item.tcea)">{{ shortRate(item.tcea) }}</span></td>
            <td class="num strong">{{ formatMoney(item.totalCost, item.currency) }}</td>
            <td><button class="secondary-button history-open" type="button" @click="emit('open', item.quotationId)">Ver cronograma</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="page && page.totalPages > 1" class="property-actions">
      <button class="text-button" type="button" :disabled="loading || current === 0" @click="load(current - 1)">Anteriores</button>
      <span>Página {{ current + 1 }} de {{ page.totalPages }}</span>
      <button class="text-button" type="button" :disabled="loading || current + 1 >= page.totalPages" @click="load(current + 1)">Siguientes</button>
    </div>
  </section>
</template>
<style scoped>
.history-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.history-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
.history-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
.history-table caption { text-align: left; padding: 10px 12px; font-size: 12.5px; color: var(--cc-text-3); }
.history-table th, .history-table td { padding: 10px 12px; border-bottom: 1px solid #eef2f7; text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums; }
.history-table thead th { background: #f1f5f9; color: var(--cc-text-2); font-size: 12px; font-weight: 650; text-transform: uppercase; letter-spacing: .03em; position: sticky; top: 0; }
.history-table tbody tr:hover { background: var(--cc-soft); }
.history-table .num { text-align: right; }
.history-table .strong { font-weight: 650; color: var(--cc-navy); }
.history-open { margin-top: 0; padding: 6px 12px; font-size: 13px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
