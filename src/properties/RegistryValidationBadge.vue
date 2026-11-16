<script setup>
import { computed, ref } from 'vue'
import { verifyPropertyRegistry, getPropertyLegitimacy } from './api.js'

const props = defineProps({
  property: { type: Object, required: true },
  canVerify: { type: Boolean, default: false },
})

const emit = defineEmits(['verified'])

const showModal = ref(false)
const verifying = ref(false)
const error = ref('')
const success = ref('')

const form = ref({
  electronicEntry: '',
  registryOffice: 'ZONA IX - SEDE LIMA',
  titleSheetNumber: '',
})

const legitimacyStatus = computed(() => {
  return props.property.legitimacyStatus || 'PENDING'
})

const statusLabel = computed(() => {
  switch (legitimacyStatus.value) {
    case 'VERIFIED': return 'Verificado SUNARP'
    case 'PARTIALLY_VERIFIED': return 'En trámite SUNARP'
    case 'REJECTED': return 'Observado / Rechazado'
    case 'PENDING':
    default:
      return 'Sin verificación registral'
  }
})

const badgeClass = computed(() => {
  switch (legitimacyStatus.value) {
    case 'VERIFIED': return 'badge-verified'
    case 'PARTIALLY_VERIFIED': return 'badge-warning'
    case 'REJECTED': return 'badge-rejected'
    case 'PENDING':
    default:
      return 'badge-pending'
  }
})

async function submitVerification() {
  if (!form.value.electronicEntry.trim() || !form.value.titleSheetNumber.trim()) {
    error.value = 'Completa la partida electrónica y el número de título registral.'
    return
  }
  verifying.value = true
  error.value = ''
  success.value = ''
  try {
    const report = await verifyPropertyRegistry(props.property.id, {
      electronicEntry: form.value.electronicEntry.trim(),
      registryOffice: form.value.registryOffice.trim(),
      titleSheetNumber: form.value.titleSheetNumber.trim(),
    })
    success.value = 'Validación SUNARP completada con éxito.'
    showModal.value = false
    emit('verified', report)
  } catch (err) {
    error.value = err.message || 'No se pudo verificar la partida registral.'
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <div class="registry-validation-container">
    <div class="badge-row">
      <span class="legitimacy-badge" :class="badgeClass">
        <svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        {{ statusLabel }}
      </span>

      <button
        v-if="canVerify && legitimacyStatus !== 'VERIFIED'"
        type="button"
        class="text-button verify-btn"
        @click="showModal = true"
      >
        Validar SUNARP
      </button>
    </div>

    <div v-if="property.legitimacyCertificateHash" class="certificate-meta">
      <small>Certificado SHA-256: <code>{{ property.legitimacyCertificateHash.slice(0, 16) }}…</code></small>
    </div>

    <!-- Modal para ingresar datos registrales -->
    <dialog v-if="showModal" open class="verify-dialog" aria-labelledby="verify-heading">
      <h3 id="verify-heading">Validación Registral SUNARP</h3>
      <p class="field-help">Ingresa los datos del predio para verificar autenticidad en la base registral oficial.</p>
      <form novalidate @submit.prevent="submitVerification">
        <div class="form-field">
          <label for="reg-entry">Partida Electrónica</label>
          <input id="reg-entry" v-model="form.electronicEntry" type="text" placeholder="Ej. 14298172" required maxlength="30" />
        </div>
        <div class="form-field">
          <label for="reg-office">Zona Registral / Oficina</label>
          <input id="reg-office" v-model="form.registryOffice" type="text" required maxlength="100" />
        </div>
        <div class="form-field">
          <label for="reg-sheet">N° de Título / Ficha</label>
          <input id="reg-sheet" v-model="form.titleSheetNumber" type="text" placeholder="Ej. P03192831" required maxlength="30" />
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="property-actions">
          <button class="primary-button" type="submit" :disabled="verifying">
            {{ verifying ? 'Verificando…' : 'Consultar SUNARP' }}
          </button>
          <button class="text-button" type="button" :disabled="verifying" @click="showModal = false">
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.registry-validation-container {
  margin: 0.5rem 0;
}
.badge-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.legitimacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.badge-icon {
  width: 14px;
  height: 14px;
}
.badge-verified {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}
.badge-warning {
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fde047;
}
.badge-rejected {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}
.badge-pending {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.verify-btn {
  font-size: 0.8rem;
  padding: 0;
  text-decoration: underline;
}
.certificate-meta {
  margin-top: 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
}
.verify-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 100;
  max-width: 420px;
  width: 90%;
}
</style>
