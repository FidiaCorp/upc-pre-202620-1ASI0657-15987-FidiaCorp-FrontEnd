<script setup>
import { computed, ref } from 'vue'
import { legitimacyBadge, verifyPropertyRegistry } from './api.js'

const props = defineProps({
  property: { type: Object, required: true },
  canVerify: { type: Boolean, default: false },
})
const emit = defineEmits(['verified'])

const showModal = ref(false)
const verifying = ref(false)
const error = ref('')
const report = ref(null)
const form = ref({ registryNumber: '', claimedOwner: '' })

// El último reporte devuelto por el servidor tiene prioridad sobre la tarjeta del catálogo.
const badge = computed(() => legitimacyBadge(report.value || props.property))

async function submitVerification() {
  if (!form.value.registryNumber.trim()) {
    error.value = 'Ingresa el número de partida electrónica (8 dígitos).'
    return
  }
  verifying.value = true
  error.value = ''
  try {
    report.value = await verifyPropertyRegistry(props.property.id, form.value)
    showModal.value = false
    emit('verified', report.value)
  } catch (err) {
    error.value = err.status === 403 ? 'Solo el propietario puede validar este inmueble.' : err.message || 'No se pudo verificar la partida registral.'
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <div class="registry-validation-container">
    <div class="badge-row">
      <span class="legitimacy-badge" :class="badge.css" :data-status="badge.status">
        <svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        {{ badge.label }}
      </span>
      <button v-if="canVerify && !badge.verified" type="button" class="text-button verify-btn" @click="showModal = true">Validar SUNARP</button>
    </div>
    <div v-if="badge.hash" class="certificate-meta">
      <small>Certificado SHA-256: <code :title="badge.hash" class="certificate-hash">{{ badge.shortHash }}</code></small>
    </div>

    <dialog v-if="showModal" open class="verify-dialog" aria-labelledby="verify-heading">
      <h3 id="verify-heading">Validación Registral SUNARP</h3>
      <p class="field-help">Consulta DEMO del Registro de Predios. El resultado se sella con un hash SHA-256.</p>
      <form novalidate @submit.prevent="submitVerification">
        <div class="form-field">
          <label for="reg-number">Partida electrónica</label>
          <input id="reg-number" v-model="form.registryNumber" type="text" inputmode="numeric" placeholder="Ej. 14298172" required maxlength="50" />
        </div>
        <div class="form-field">
          <label for="reg-owner">Titular declarado (opcional)</label>
          <input id="reg-owner" v-model="form.claimedOwner" type="text" maxlength="200" />
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="property-actions">
          <button class="primary-button" type="submit" :disabled="verifying">{{ verifying ? 'Verificando…' : 'Consultar SUNARP' }}</button>
          <button class="text-button" type="button" :disabled="verifying" @click="showModal = false">Cancelar</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.registry-validation-container { margin: 2px 0 4px; }
.badge-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.legitimacy-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; line-height: 1.3; }
.badge-icon { width: 14px; height: 14px; flex: none; }
.badge-verified { background: var(--cc-success-bg); color: var(--cc-success); border: 1px solid #bbf7d0; }
.badge-rejected { background: var(--cc-warning-bg); color: var(--cc-warning); border: 1px solid var(--cc-warning-border); }
.badge-pending { background: #f1f5f9; color: var(--cc-text-2); border: 1px solid var(--cc-border); }
.verify-btn { font-size: 12.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--cc-soft-border); background: var(--cc-soft); color: var(--cc-navy); font-weight: 600; text-decoration: none; }
.verify-btn:hover { background: #dbeafe; }
.certificate-meta { margin-top: 6px; color: var(--cc-text-3); font-size: 12px; }
.certificate-hash { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f1f5f9; padding: 1px 6px; border-radius: 6px; color: var(--cc-navy); }
.verify-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 1px solid var(--cc-border); border-radius: 16px; padding: 24px; background: #fff; box-shadow: 0 24px 48px rgba(15, 23, 42, .18); z-index: 100; max-width: 440px; width: 92%; margin: 0; }
.verify-dialog h3 { margin: 0 0 6px; color: var(--cc-navy); }
</style>
