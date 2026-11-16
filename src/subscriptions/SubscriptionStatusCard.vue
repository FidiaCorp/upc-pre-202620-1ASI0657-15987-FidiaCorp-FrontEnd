<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getSubscriptionStatus, verifyPayment } from './api.js'
import { formatDate } from '../offers/format.js'

const statusData = ref(null)
const loading = ref(true)
const verifying = ref(false)
const error = ref('')
const success = ref('')
const showRenew = ref(false)

const renewForm = reactive({
  plan: 'PREMIUM',
  amount: '49.90',
  currency: 'PEN',
  externalPaymentId: '',
})

async function loadStatus() {
  loading.value = true
  error.value = ''
  try {
    statusData.value = await getSubscriptionStatus()
  } catch (err) {
    error.value = err.message || 'No se pudo consultar el estado de la suscripción.'
  } finally {
    loading.value = false
  }
}

async function handleVerifyPayment() {
  if (!renewForm.externalPaymentId.trim()) {
    error.value = 'Ingresa el código o número de referencia de la transferencia/pago.'
    return
  }
  verifying.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await verifyPayment({
      subscriptionPlan: renewForm.plan,
      amount: renewForm.amount,
      currency: renewForm.currency,
      externalPaymentId: renewForm.externalPaymentId.trim(),
    })
    success.value = res.message || 'Pago verificado exitosamente. Tu suscripción está activa.'
    showRenew.value = false
    renewForm.externalPaymentId = ''
    await loadStatus()
  } catch (err) {
    error.value = err.message || 'No se pudo verificar el pago.'
  } finally {
    verifying.value = false
  }
}

onMounted(loadStatus)
</script>

<template>
  <section class="content-card subscription-card" aria-labelledby="sub-title">
    <div class="subscription-header">
      <h2 id="sub-title">Estado de Suscripción</h2>
      <span
        v-if="statusData"
        class="badge"
        :class="{
          'badge-success': statusData.active,
          'badge-warning': statusData.status === 'PENDING',
          'badge-danger': statusData.status === 'EXPIRED' || statusData.status === 'CANCELLED'
        }"
      >
        {{ statusData.active ? 'ACTIVA' : statusData.status }}
      </span>
    </div>

    <p v-if="loading" role="status">Cargando estado de suscripción…</p>
    <div v-else-if="statusData" class="subscription-details">
      <dl class="offer-details">
        <dt>Plan Actual</dt>
        <dd><strong>{{ statusData.plan }}</strong></dd>
        <dt>Estado</dt>
        <dd>{{ statusData.status }}</dd>
        <dt>Vigencia hasta</dt>
        <dd>{{ statusData.expiresAt ? formatDate(statusData.expiresAt) : 'Sin fecha de expiración' }}</dd>
        <dt>Pagos confirmados</dt>
        <dd>{{ statusData.paymentCount ?? 0 }}</dd>
      </dl>

      <div class="subscription-actions">
        <button
          v-if="!showRenew"
          class="primary-button"
          type="button"
          @click="showRenew = true"
        >
          {{ statusData.active ? 'Mejorar o renovar plan' : 'Activar suscripción' }}
        </button>
      </div>

      <form
        v-if="showRenew"
        class="account-form renew-form"
        novalidate
        :aria-busy="verifying"
        @submit.prevent="handleVerifyPayment"
      >
        <fieldset :disabled="verifying">
          <legend>Validación de comprobante / pago</legend>
          <div class="form-field">
            <label for="sub-plan">Selecciona el Plan</label>
            <select id="sub-plan" v-model="renewForm.plan">
              <option value="BASIC">Plan Básico (S/ 29.90 / mes)</option>
              <option value="PREMIUM">Plan Premium (S/ 49.90 / mes)</option>
              <option value="PRO">Plan Inmobiliario Pro (S/ 99.90 / mes)</option>
            </select>
          </div>
          <div class="form-field">
            <label for="sub-ref">Nro. de Operación / Referencia de Pago</label>
            <input
              id="sub-ref"
              v-model="renewForm.externalPaymentId"
              type="text"
              required
              placeholder="Ej. BCP-10293848 o YAPE-839210"
              maxlength="64"
            />
          </div>
          <div class="property-actions">
            <button class="primary-button" type="submit">
              {{ verifying ? 'Verificando…' : 'Validar pago' }}
            </button>
            <button
              class="text-button"
              type="button"
              :disabled="verifying"
              @click="showRenew = false"
            >
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="success" class="success-message" role="status">{{ success }}</p>
  </section>
</template>

<style scoped>
.subscription-card {
  margin-top: 1.5rem;
  padding: 1.25rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
}
.subscription-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}
.badge-success {
  background-color: #dcfce7;
  color: #166534;
}
.badge-warning {
  background-color: #fef9c3;
  color: #854d0e;
}
.badge-danger {
  background-color: #fee2e2;
  color: #991b1b;
}
.renew-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed #cbd5e1;
}
</style>
