<script setup>
// Gráfico de barras apiladas en SVG nativo: capital (amortización) + intereses por periodo.
import { computed, ref } from 'vue'
import { compactAmount, niceScale, paymentSeries } from './chart.js'
import { formatMoney } from './model.js'

const props = defineProps({ schedule: { type: Array, required: true }, currency: { type: String, default: 'PEN' } })

const W = 720, H = 260, PAD = { top: 16, right: 12, bottom: 34, left: 56 }
const series = computed(() => paymentSeries(props.schedule))
const scale = computed(() => niceScale(Math.max(0, ...series.value.buckets.map(b => b.total))))
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom
const slot = computed(() => plotW / Math.max(1, series.value.buckets.length))
const barW = computed(() => Math.max(3, Math.min(34, slot.value * 0.62)))
const y = value => PAD.top + plotH - (value / scale.value.max) * plotH
const bars = computed(() => series.value.buckets.map((bucket, index) => {
  const x = PAD.left + slot.value * index + (slot.value - barW.value) / 2
  const yPrincipal = y(bucket.principal)
  const yTotal = y(bucket.total)
  return { ...bucket, index, x, yPrincipal, hPrincipal: PAD.top + plotH - yPrincipal, yInterest: yTotal, hInterest: yPrincipal - yTotal }
}))
const labelEvery = computed(() => Math.ceil(series.value.buckets.length / 12))
const active = ref(null)
const tooltipStyle = computed(() => {
  if (!active.value) return {}
  const left = ((active.value.x + barW.value / 2) / W) * 100
  return { left: `${Math.min(82, Math.max(18, left))}%`, top: `${(active.value.yInterest / H) * 100}%` }
})
const periodLabel = bucket => series.value.grouping === 'month' ? `Cuota ${bucket.label}` : `${bucket.label} (cuotas ${bucket.from}–${bucket.to})`
const summary = computed(() => `Evolución de pago: ${series.value.buckets.length} ${series.value.grouping === 'month' ? 'meses' : 'años'}; barras de capital e intereses.`)
</script>

<template>
  <figure class="chart-card" aria-labelledby="payment-chart-title">
    <div class="chart-header">
      <div>
        <h3 id="payment-chart-title">Evolución de pago del crédito</h3>
        <p class="field-help">{{ series.grouping === 'month' ? 'Detalle mensual por cuota.' : 'Totales agregados por año del crédito.' }}</p>
      </div>
      <ul class="chart-legend" aria-label="Leyenda">
        <li><span class="swatch swatch-principal" aria-hidden="true"></span>Capital</li>
        <li><span class="swatch swatch-interest" aria-hidden="true"></span>Intereses</li>
      </ul>
    </div>
    <div class="chart-body" @mouseleave="active = null">
      <svg class="chart-svg" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="summary">
        <g v-for="tick in scale.ticks" :key="tick">
          <line class="grid-line" :x1="PAD.left" :x2="W - PAD.right" :y1="y(tick)" :y2="y(tick)" />
          <text class="axis-label" :x="PAD.left - 8" :y="y(tick) + 4" text-anchor="end">{{ compactAmount(tick) }}</text>
        </g>
        <g v-for="bar in bars" :key="bar.index" class="bar-group" :class="{ active: active && active.index === bar.index }" @mouseenter="active = bar">
          <rect class="bar-hit" :x="PAD.left + slot * bar.index" :y="PAD.top" :width="slot" :height="plotH" />
          <rect class="bar-principal" :x="bar.x" :y="bar.yPrincipal" :width="barW" :height="Math.max(0, bar.hPrincipal)" rx="2" />
          <rect class="bar-interest" :x="bar.x" :y="bar.yInterest" :width="barW" :height="Math.max(0, bar.hInterest)" rx="2" />
          <text v-if="bar.index % labelEvery === 0" class="axis-label" :x="bar.x + barW / 2" :y="H - PAD.bottom + 18" text-anchor="middle">{{ series.grouping === 'month' ? bar.label : bar.label.replace('Año ', 'A') }}</text>
        </g>
      </svg>
      <div v-if="active" class="chart-tooltip" :style="tooltipStyle" aria-hidden="true">
        <strong>{{ periodLabel(active) }}</strong>
        <span><i class="swatch swatch-principal"></i>Capital: {{ formatMoney(active.principal.toFixed(2), currency) }}</span>
        <span><i class="swatch swatch-interest"></i>Intereses: {{ formatMoney(active.interest.toFixed(2), currency) }}</span>
        <span class="tooltip-total">Total: {{ formatMoney(active.total.toFixed(2), currency) }}</span>
      </div>
    </div>
  </figure>
</template>
