<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, register } from '../account/api.js'
import { isValidOtp, twoFactorError } from '../account/twoFactor.js'
import { startSession } from '../account/session.js'
import { normalizeProfile, safeRedirect, validateAccount } from '../account/validation.js'

const route = useRoute()
const router = useRouter()
const registering = computed(() => route.name === 'register')
const form = reactive({ firstName: '', lastName: '', email: '', password: '' })
const errors = ref({})
const message = ref('')
const busy = ref(false)
const otpRequired = ref(false)
const otp = ref('')
const now = ref(Date.now())
const lockedUntil = ref(0)
const retrySeconds = computed(() => Math.max(0, Math.ceil((lockedUntil.value - now.value) / 1000)))
const clock = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => { clearInterval(clock); form.password = ''; otp.value = '' })
watch(() => [form.email, form.password], () => { otpRequired.value = false; otp.value = '' })
watch(() => route.name, () => {
  Object.assign(form, { firstName: '', lastName: '', email: '', password: '' })
  errors.value = {}
  otpRequired.value = false
  otp.value = ''
  message.value = ''
})

async function submit() {
  if (busy.value || retrySeconds.value) return
  errors.value = validateAccount(form, { names: registering.value, registration: registering.value })
  message.value = ''
  if (!registering.value && otpRequired.value && !isValidOtp(otp.value)) errors.value.otp = 'Ingresa un código de seis dígitos.'
  if (Object.keys(errors.value).length) { message.value = 'Revisa los campos indicados.'; return }
  busy.value = true
  try {
    if (registering.value) {
      await register({ ...normalizeProfile(form), password: form.password })
      await router.replace({ name: 'login', query: { registered: '1', redirect: safeRedirect(route.query.redirect) } })
    } else {
      const auth = await login({ email: form.email.trim().toLowerCase(), password: form.password, ...(otpRequired.value ? { otp: otp.value } : {}) })
      startSession(auth)
      form.password = ''
      await router.replace(safeRedirect(route.query.redirect))
    }
  } catch (error) {
    errors.value = error.validationErrors || {}
    if (['TWO_FACTOR_REQUIRED', 'TWO_FACTOR_INVALID'].includes(error.code)) { otpRequired.value = true; otp.value = '' }
    if (error.status === 429) lockedUntil.value = Date.now() + Math.max(1, error.retryAfter || 60) * 1000
    message.value = error.code ? twoFactorError(error) : error.status === 401 ? 'Correo o contraseña incorrectos.' : error.status === 409 ? 'Este correo ya está registrado. Ingresa a tu cuenta o utiliza otro correo.' : error.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="content-card account-card" aria-labelledby="page-title">
    <h1 id="page-title">{{ registering ? 'Crear cuenta' : 'Ingresar' }}</h1>
    <p v-if="!registering && route.query.registered === '1'" class="success-message" role="status">Cuenta creada. Ingresa con tu correo y contraseña.</p>
    <p v-if="!registering && route.query.expired === '1'" role="status">Tu sesión terminó. Ingresa nuevamente.</p>
    <form class="account-form" novalidate :aria-busy="busy" @submit.prevent="submit">
      <fieldset :disabled="busy || retrySeconds > 0">
        <template v-if="registering">
          <div v-for="field in [{ key: 'firstName', label: 'Nombres', autocomplete: 'given-name' }, { key: 'lastName', label: 'Apellidos', autocomplete: 'family-name' }]" :key="field.key" class="form-field">
            <label :for="field.key">{{ field.label }}</label>
            <input :id="field.key" v-model="form[field.key]" required maxlength="100" :autocomplete="field.autocomplete" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? `${field.key}-error` : undefined" />
            <p v-if="errors[field.key]" :id="`${field.key}-error`" class="field-error">{{ errors[field.key] }}</p>
          </div>
        </template>
        <div class="form-field">
          <label for="email">Correo electrónico</label>
          <input id="email" v-model="form.email" type="email" required maxlength="254" autocomplete="username" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'email-error' : undefined" />
          <p v-if="errors.email" id="email-error" class="field-error">{{ errors.email }}</p>
        </div>
        <div class="form-field">
          <label for="password">Contraseña</label>
          <input id="password" v-model="form.password" type="password" required :autocomplete="registering ? 'new-password' : 'current-password'" :aria-invalid="Boolean(errors.password)" :aria-describedby="errors.password ? 'password-error' : registering ? 'password-help' : undefined" />
          <p v-if="registering" id="password-help" class="field-help">De 12 a 72 caracteres y hasta 72 bytes UTF-8.</p>
          <p v-if="errors.password" id="password-error" class="field-error">{{ errors.password }}</p>
        </div>
        <div v-if="!registering && otpRequired" class="form-field">
          <label for="login-otp">Código de verificación</label>
          <input id="login-otp" v-model="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required :aria-invalid="Boolean(errors.otp)" aria-describedby="login-otp-help" />
          <p id="login-otp-help" :class="errors.otp ? 'field-error' : 'field-help'">{{ errors.otp || 'Usa el código actual de tu aplicación autenticadora. Cada código se puede usar una sola vez.' }}</p>
        </div>
        <button class="primary-button" type="submit">{{ busy ? 'Procesando…' : registering ? 'Crear cuenta' : 'Ingresar' }}</button>
      </fieldset>
      <p v-if="retrySeconds" role="status">Puedes intentar nuevamente en {{ retrySeconds }} segundos.</p>
      <p v-if="message" class="form-error" role="alert">{{ message }}</p>
    </form>
    <RouterLink class="text-link" :to="{ name: registering ? 'login' : 'register', query: { redirect: safeRedirect(route.query.redirect) } }">{{ registering ? 'Ya tengo una cuenta' : 'Crear una cuenta' }}</RouterLink>
  </section>
</template>
