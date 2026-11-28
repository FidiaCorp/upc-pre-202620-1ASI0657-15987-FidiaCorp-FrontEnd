<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { PAID_PLANS, checkoutPayment, getSubscriptionStatus, listPaymentGateways, subscriptionSummary, verifyPayment } from './api.js'
import { formatDate } from '../offers/format.js'
import { formatMoney } from '../simulations/model.js'

const statusData = ref(null)
const gateways = ref([])
const loading = ref(true)
const paying = ref(false)
const error = ref('')
const success = ref('')
const rejection = ref(null)
const showCheckout = ref(false)
const form = reactive({ plan: 'PREMIUM', gateway: 'CULQI', cardToken: 'tok_visa_approved' })

const summary = computed(() => subscriptionSummary(statusData.value))
const selectedGateway = computed(() => gateways.value.find(g => g.code === form.gateway))
const planFee = computed(() => selectedGateway.value?.planFees?.[form.plan] || null)

async function loadStatus() {
  loading.value = true
  error.value = ''
  try {
    const [status, available] = await Promise.all([getSubscriptionStatus(), listPaymentGateways()])
    statusData.value = status
    gateways.value = Array.isArray(available) ? available : []
    if (gateways.value.length && !gateways.value.some(g => g.code === form.gateway)) form.gateway = gateways.value[0].code
  } catch (err) {
    error.value = err.message || 'No se pudo consultar el estado de la suscripción.'
  } finally {
    loading.value = false
  }
}

async function pay() {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(form.cardToken.trim())) {
    error.value = 'Ingresa un token de tarjeta sandbox válido (6 a 64 caracteres: letras, números, _ o -).'
    return
  }
  paying.value = true
  error.value = ''
  success.value = ''
  rejection.value = null
  try {
    const charge = await checkoutPayment({ gatewayCode: form.gateway, planName: form.plan, cardToken: form.cardToken.trim() })
    if (charge.status !== 'APPROVED') {
      rejection.value = charge
      error.value = `${charge.message} Selecciona otra pasarela o tarjeta y vuelve a intentarlo.`
      return
    }
    const receipt = await verifyPayment({
      transactionReference: charge.transactionReference,
      paymentMethod: charge.gatewayCode,
      amount: charge.amount,
      currency: charge.currency,
      planName: charge.planName,
    })
    success.value = receipt.message || 'Pago verificado. Tu suscripción está activa.'
    showCheckout.value = false
    await loadStatus()
  } catch (err) {
    error.value = err.message || 'No se pudo procesar el pago.'
  } finally {
    paying.value = false
  }
}

onMounted(loadStatus)
</script>

<template>
  <section class="content-card subscription-card" aria-labelledby="sub-title">
    <div class="subscription-header">
      <h2 id="sub-title">Estado de Suscripción</h2>
      <span
        v-if="summary"
        class="badge subscription-badge"
        :class="{
          'badge-success': statusData.active,
          'badge-warning': statusData.status === 'PENDING',
          'badge-danger': statusData.status === 'EXPIRED' || statusData.status === 'CANCELLED'
        }"
      >{{ summary.badge }}</span>
    </div>

    <p v-if="loading" role="status">Cargando estado de suscripción…</p>
    <div v-else-if="summary" class="subscription-details">
      <dl class="offer-details subscription-facts">
        <dt>Plan actual</dt>
        <dd><strong class="subscription-plan">{{ summary.plan }}</strong></dd>
        <dt>Vigencia hasta</dt>
        <dd class="subscription-end">{{ summary.validUntil ? formatDate(summary.validUntil) : 'Sin fecha de vencimiento' }}</dd>
        <dt>Detalle</dt>
        <dd class="subscription-description">{{ summary.description }}</dd>
        <dt>Pagos confirmados</dt>
        <dd class="subscription-payments">{{ summary.payments }}</dd>
      </dl>

      <ul class="plan-cards" aria-label="Planes disponibles">
        <li class="plan-card" :class="{ current: !statusData.active }"><span class="plan-name">Gratuito</span><span class="plan-price">S/ 0</span><span class="field-help">Simulador, catálogo y mensajería básica.</span></li>
        <li v-for="plan in PAID_PLANS" :key="plan" class="plan-card" :class="{ current: summary.plan === plan, selected: showCheckout && form.plan === plan }"><span class="plan-name">{{ plan }}</span><span class="plan-price">{{ selectedGateway?.planFees?.[plan] ? formatMoney(selectedGateway.planFees[plan], 'PEN') : '—' }}<small> / mes</small></span><span class="field-help">{{ plan === 'PREMIUM' ? 'Asistente IA, comparador y exportaciones ilimitadas.' : 'Funciones avanzadas para asesores y equipos.' }}</span></li>
      </ul>

      <button v-if="!showCheckout" class="primary-button" type="button" @click="showCheckout = true">
        {{ statusData.active ? 'Mejorar o renovar plan' : 'Activar suscripción' }}
      </button>

      <form v-if="showCheckout" class="account-form renew-form" novalidate :aria-busy="paying" @submit.prevent="pay">
        <fieldset :disabled="paying">
          <legend>Pago con pasarela (modo sandbox)</legend>
          <div class="form-field">
            <label for="sub-plan">Plan</label>
            <select id="sub-plan" v-model="form.plan">
              <option v-for="plan in PAID_PLANS" :key="plan" :value="plan">
                {{ plan }} ({{ formatMoney(selectedGateway?.planFees?.[plan], 'PEN') }} / mes)
              </option>
            </select>
          </div>
          <div class="form-field" role="radiogroup" aria-label="Procesador de pago">
            <span class="field-label">Procesador de pago</span>
            <label v-for="gateway in gateways" :key="gateway.code" class="checkbox-label gateway-option" :class="{ selected: form.gateway === gateway.code }">
              <input v-model="form.gateway" type="radio" name="gateway" :value="gateway.code" :aria-label="gateway.displayName" />
              {{ gateway.displayName }} · comisión {{ gateway.commissionPercent }} %{{ gateway.fixedFee !== '0.00' ? ` + ${gateway.fixedFee}` : '' }}
            </label>
          </div>
          <div class="form-field">
            <label for="sub-card-token">Token de tarjeta (sandbox)</label>
            <input id="sub-card-token" v-model="form.cardToken" type="text" required maxlength="64" aria-describedby="sub-card-help" />
            <p id="sub-card-help" class="field-help">Usa <code>tok_visa_approved</code> para aprobar o <code>tok_DECLINED_INSUFFICIENT_FUNDS</code> para simular fondos insuficientes. No se realizan cobros reales.</p>
          </div>
          <p v-if="planFee" class="field-help total-row">Total a cobrar: <strong>{{ formatMoney(planFee, 'PEN') }}</strong></p>
          <div class="property-actions">
            <button class="primary-button" type="submit">{{ paying ? 'Procesando pago…' : `Pagar con ${selectedGateway?.displayName || form.gateway}` }}</button>
            <button class="text-button" type="button" :disabled="paying" @click="showCheckout = false">Cancelar</button>
          </div>
        </fieldset>
      </form>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="rejection" class="decline-code">Código de rechazo: {{ rejection.declineCode }} · Puedes reintentar con otro procesador.</p>
    <p v-if="success" class="success-message" role="status">{{ success }}</p>
  </section>
</template>

<style scoped>
.subscription-card { margin: 0; }
.subscription-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
.subscription-header h2 { margin: 0; }
.badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; border: 1px solid var(--cc-border); background: #f1f5f9; color: var(--cc-text-2); }
.badge-success { background: var(--cc-success-bg); color: var(--cc-success); border-color: var(--cc-success-border); }
.badge-warning, .badge-danger { background: var(--cc-warning-bg); color: var(--cc-warning); border-color: var(--cc-warning-border); }
.subscription-facts { margin-bottom: 16px; }
.plan-cards { list-style: none; padding: 0; margin: 0 0 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.plan-card { display: grid; gap: 4px; align-content: start; padding: 14px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); background: #fff; }
.plan-card.current { border-color: var(--cc-soft-border); background: var(--cc-soft); }
.plan-card.selected { border-color: var(--cc-blue); box-shadow: 0 0 0 3px rgba(29, 78, 216, .12); }
.plan-name { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--cc-navy); }
.plan-price { font-size: 20px; font-weight: 750; color: var(--cc-text); font-variant-numeric: tabular-nums; }
.plan-price small { font-size: 12px; font-weight: 500; color: var(--cc-text-3); }
.plan-card .field-help { margin: 0; }
.renew-form { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--cc-border); }
.gateway-option { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); margin: 0 0 8px; cursor: pointer; background: #fff; }
.gateway-option.selected { border-color: var(--cc-blue); background: var(--cc-soft); color: var(--cc-navy); font-weight: 600; }
.gateway-option input { accent-color: var(--cc-blue); width: 16px; height: 16px; }
.field-label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
.total-row { font-size: 14px; color: var(--cc-text); padding: 10px 12px; background: var(--cc-canvas); border: 1px dashed var(--cc-soft-border); border-radius: var(--cc-radius-sm); }
.decline-code { margin: 8px 0 0; font-size: 13px; color: var(--cc-danger); background: var(--cc-danger-bg); border: 1px solid #fecaca; border-radius: var(--cc-radius-sm); padding: 8px 12px; }
</style>
