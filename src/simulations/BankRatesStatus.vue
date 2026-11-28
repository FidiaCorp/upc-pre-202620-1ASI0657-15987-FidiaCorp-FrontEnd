<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
import { loadBenchmarkStatus } from './benchmarks.js'

const status = ref(null)
const checking = ref(false)
let disposed = false
async function refresh() {
  if (checking.value) return
  checking.value = true
  const value = await loadBenchmarkStatus()
  if (!disposed) { status.value = value; checking.value = false }
}
onMounted(refresh)
onUnmounted(() => { disposed = true })
</script>
<template>
  <p v-if="status" class="rates-status" role="status" :title="status.detail" data-testid="bank-rates-status">
    <span>Tasas de referencia:</span>
    <span class="pill" :class="status.state === 'live' ? 'pill-success' : 'pill-warning'">
      <AppIcon :name="status.state === 'live' ? 'check' : 'alert'" :size="13" />{{ status.label }}
    </span>
    <span v-if="status.asOfDate" class="rates-status-date">corte {{ status.asOfDate }}</span>
    <button type="button" class="rates-status-refresh" :disabled="checking" aria-label="Actualizar el origen de las tasas de referencia" @click="refresh">
      <AppIcon name="refresh" :size="14" />
    </button>
  </p>
</template>
<style scoped>
.rates-status { display: inline-flex; align-items: center; gap: 8px; margin: 8px 0 0; font-size: 13px; color: var(--cc-text-2); flex-wrap: wrap; }
.rates-status-date { font-size: 12px; }
.rates-status-refresh { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 999px; border: 1px solid var(--cc-border); background: #fff; color: var(--cc-navy); cursor: pointer; }
.rates-status-refresh:disabled { opacity: .5; cursor: default; }
</style>
