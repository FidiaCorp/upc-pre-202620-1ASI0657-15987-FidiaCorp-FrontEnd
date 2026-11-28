<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { confirmTwoFactor, disableTwoFactor, getTwoFactorStatus, setupTwoFactor } from './api.js'
import { isValidOtp, twoFactorError } from './twoFactor.js'

const status = ref(null)
const busy = ref(false)
const password = ref('')
const otp = ref('')
const setup = ref(null)
const expiresAt = ref(0)
const now = ref(Date.now())
const lockedUntil = ref(0)
const retrySeconds = computed(() => Math.max(0, Math.ceil((lockedUntil.value - now.value) / 1000)))
const remaining = computed(() => Math.max(0, Math.ceil((expiresAt.value - now.value) / 1000)))
const message = ref('')
const success = ref('')
let disposed = false
function clearSecrets() { setup.value = null; expiresAt.value = 0; password.value = ''; otp.value = '' }
const clock = setInterval(() => {
  now.value = Date.now()
  if (setup.value && now.value >= expiresAt.value) {
    clearSecrets()
    message.value = 'La configuración venció. Genera una nueva clave para continuar.'
  }
}, 1000)
onUnmounted(() => { disposed = true; clearInterval(clock); clearSecrets() })

async function perform(action) {
  if (busy.value || retrySeconds.value) return
  busy.value = true
  message.value = ''
  success.value = ''
  try { await action() } catch (error) {
    if (disposed) return
    message.value = twoFactorError(error)
    if (error.status === 429) lockedUntil.value = Date.now() + Math.max(1, error.retryAfter || 60) * 1000
    if (error.code === 'TWO_FACTOR_SETUP_EXPIRED') clearSecrets()
  } finally { busy.value = false }
}
async function refresh() {
  await perform(async () => { const result = await getTwoFactorStatus(); if (!disposed) status.value = result })
}
async function beginSetup() {
  if (!password.value) { message.value = 'Ingresa tu contraseña para generar la clave.'; return }
  await perform(async () => {
    try {
      const result = await setupTwoFactor(password.value)
      if (disposed) return
      setup.value = result
      expiresAt.value = Date.now() + result.expiresIn * 1000
      now.value = Date.now()
      status.value = { enabled: false, pending: true }
      otp.value = ''
    } finally { password.value = '' }
  })
}
async function confirm() {
  if (!isValidOtp(otp.value)) { message.value = 'Ingresa un código de seis dígitos.'; return }
  await perform(async () => {
    try {
      const result = await confirmTwoFactor(otp.value)
      if (disposed) return
      status.value = result
      clearSecrets()
      success.value = 'Segundo factor activado. Para ingresar o desactivarlo, espera al siguiente código de tu aplicación.'
    } finally { otp.value = '' }
  })
}
async function disable() {
  if (!password.value || !isValidOtp(otp.value)) { message.value = 'Ingresa tu contraseña y un código de seis dígitos.'; return }
  await perform(async () => {
    try {
      const result = await disableTwoFactor(password.value, otp.value)
      if (disposed) return
      status.value = result
      clearSecrets()
      success.value = 'Segundo factor desactivado.'
    } finally { password.value = ''; otp.value = '' }
  })
}
onMounted(refresh)
</script>

<template>
  <section class="two-factor-settings" aria-labelledby="two-factor-title">
    <h2 id="two-factor-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> Verificación en dos pasos</h2>
    <p v-if="!status && busy" role="status">Consultando el segundo factor…</p>
    <template v-if="status">
      <p role="status" class="two-factor-status" :data-enabled="status.enabled">Estado: {{ status.enabled ? 'Activado' : 'Desactivado' }}.</p>
      <p v-if="!status.enabled && status.pending && !setup" class="field-help">Existe una configuración pendiente. Genera otra clave para reemplazarla y continuar.</p>
      <form v-if="!setup" class="account-form" novalidate :aria-busy="busy" @submit.prevent="status.enabled ? disable() : beginSetup()">
        <p>{{ status.enabled ? 'Para desactivar, usa tu contraseña y un código que no hayas utilizado antes. Si acabas de ingresar, espera al siguiente código.' : 'Genera una clave e incorpórala manualmente en una aplicación autenticadora compatible con TOTP.' }}</p>
        <fieldset :disabled="busy || retrySeconds > 0">
          <div class="form-field">
            <label for="two-factor-password">Contraseña actual</label>
            <input id="two-factor-password" v-model="password" type="password" autocomplete="current-password" required />
          </div>
          <div v-if="status.enabled" class="form-field">
            <label for="disable-otp">Código de verificación</label>
            <input id="disable-otp" v-model="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required />
          </div>
          <button type="submit" class="primary-button">{{ busy ? 'Procesando…' : status.enabled ? 'Desactivar segundo factor' : 'Generar clave de configuración' }}</button>
        </fieldset>
      </form>
      <div v-if="setup" class="setup-details">
        <ol class="steps" aria-label="Pasos de activación">
          <li class="done">Clave de configuración generada</li>
          <li>Añádela en tu aplicación autenticadora</li>
          <li>Ingresa el código de 6 dígitos para confirmar</li>
        </ol>
        <p>En tu aplicación autenticadora, añade una cuenta con esta clave (TOTP, 6 dígitos, intervalo de 30 segundos). Después ingresa el código para activar.</p>
        <p class="field-help">La clave se oculta al salir o terminar. La configuración vence en {{ remaining }} segundos.</p>
        <p class="secret-row"><strong>Clave manual:</strong> <code class="setup-secret">{{ setup.secret }}</code></p>
        <details>
          <summary>Ver URI de configuración</summary>
          <code class="setup-uri">{{ setup.otpauthUri }}</code>
        </details>
        <form class="account-form" novalidate :aria-busy="busy" @submit.prevent="confirm">
          <fieldset :disabled="busy || retrySeconds > 0">
            <div class="form-field">
              <label for="confirm-otp">Código de verificación</label>
              <input id="confirm-otp" v-model="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required />
            </div>
            <button class="primary-button" type="submit">{{ busy ? 'Verificando…' : 'Confirmar activación' }}</button>
          </fieldset>
        </form>
        <button type="button" class="text-button" :disabled="busy" @click="clearSecrets">Ocultar clave y volver</button>
      </div>
    </template>
    <p v-if="message" class="form-error" role="alert">{{ message }}</p>
    <p v-if="success" class="success-message" role="status">{{ success }}</p>
    <p v-if="retrySeconds" role="status">Puedes intentar nuevamente en {{ retrySeconds }} segundos.</p>
    <button v-if="!setup" type="button" class="text-button" :disabled="busy || retrySeconds > 0" @click="refresh">Actualizar estado</button>
  </section>
</template>

<style scoped>
.two-factor-settings h2 { display: flex; align-items: center; gap: 8px; margin-top: 0; }
.two-factor-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 999px; background: #f1f5f9; color: var(--cc-text-2); border: 1px solid var(--cc-border); }
.two-factor-status[data-enabled="true"] { background: var(--cc-success-bg); color: var(--cc-success); border-color: var(--cc-success-border); }
.secret-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.setup-details { margin-top: 12px; }
.setup-uri { display: block; font-size: 12px; overflow-wrap: anywhere; margin-top: 6px; color: var(--cc-text-3); }
</style>
