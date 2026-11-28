<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, register } from '../account/api.js'
import { isValidOtp, twoFactorError } from '../account/twoFactor.js'
import { startSession } from '../account/session.js'
import { normalizeProfile, safeRedirect, validateAccount } from '../account/validation.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
import BrandLogo from '../shared/presentation/components/BrandLogo.vue'
import { HERO_PHOTO } from '../properties/images.js'

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
const pillars = [
  { icon: 'calculator', title: 'Cálculo exacto SBS', text: 'Método francés con aritmética decimal BigDecimal: TEA, TCEA, VAN y TIR sin redondeos ocultos.' },
  { icon: 'shield', title: 'Inmuebles verificados SUNARP', text: 'Validación registral sellada con huella SHA-256 para cada partida.' },
  { icon: 'layers', title: 'Cotizaciones versionadas', text: 'Versiones inmutables de cada oferta, exportables en PDF y XLSX.' },
]
</script>

<template>
  <section class="auth-layout" aria-labelledby="page-title">
    <div class="auth-aside">
      <RouterLink class="brand" to="/home" aria-label="CrediCasa, inicio"><BrandLogo /></RouterLink>
      <div class="auth-copy">
        <p class="eyebrow">Plataforma hipotecaria</p>
        <p class="auth-headline">Financiamiento hipotecario de forma simple y transparente</p>
        <p class="auth-lead">Simula tu crédito, compara escenarios y recibe cotizaciones de inmuebles verificados en un solo lugar.</p>
        <ul class="auth-pillars">
          <li v-for="pillar in pillars" :key="pillar.title"><span class="pillar-icon"><AppIcon :name="pillar.icon" :size="18" /></span><span><strong>{{ pillar.title }}</strong><span>{{ pillar.text }}</span></span></li>
        </ul>
      </div>
      <div class="auth-photo"><img :src="HERO_PHOTO" alt="Casa moderna con detalles azul marino" width="1280" height="714" /></div>
    </div>

    <div class="auth-panel">
      <div class="auth-card">
        <nav class="auth-tabs" aria-label="Tipo de acceso">
          <RouterLink :to="{ name: 'login', query: { redirect: safeRedirect(route.query.redirect) } }" :class="{ active: !registering }" :aria-current="!registering ? 'page' : undefined">Iniciar sesión</RouterLink>
          <RouterLink :to="{ name: 'register', query: { redirect: safeRedirect(route.query.redirect) } }" :class="{ active: registering }" :aria-current="registering ? 'page' : undefined">Crear cuenta</RouterLink>
        </nav>
        <h1 id="page-title">{{ registering ? 'Crea tu cuenta' : 'Ingresa a CrediCasa' }}</h1>
        <p class="page-subtitle">{{ registering ? 'Regístrate para guardar simulaciones, recibir ofertas y contactar asesores.' : 'Accede para continuar con tus simulaciones y ofertas.' }}</p>
        <p v-if="!registering && route.query.registered === '1'" class="success-message" role="status">Cuenta creada. Ingresa con tu correo y contraseña.</p>
        <p v-if="!registering && route.query.expired === '1'" class="info-notice" role="status">Tu sesión terminó. Ingresa nuevamente.</p>
        <form class="account-form" novalidate :aria-busy="busy" @submit.prevent="submit">
          <fieldset :disabled="busy || retrySeconds > 0">
            <div v-if="registering" class="form-grid-2">
              <div v-for="field in [{ key: 'firstName', label: 'Nombres', autocomplete: 'given-name' }, { key: 'lastName', label: 'Apellidos', autocomplete: 'family-name' }]" :key="field.key" class="form-field">
                <label :for="field.key">{{ field.label }}</label>
                <input :id="field.key" v-model="form[field.key]" required maxlength="100" :autocomplete="field.autocomplete" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? `${field.key}-error` : undefined" />
                <p v-if="errors[field.key]" :id="`${field.key}-error`" class="field-error">{{ errors[field.key] }}</p>
              </div>
            </div>
            <div class="form-field">
              <label for="email">Correo electrónico</label>
              <div class="input-icon"><AppIcon name="mail" :size="16" /><input id="email" v-model="form.email" type="email" required maxlength="254" autocomplete="username" placeholder="nombre@correo.com" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'email-error' : undefined" /></div>
              <p v-if="errors.email" id="email-error" class="field-error">{{ errors.email }}</p>
            </div>
            <div class="form-field">
              <label for="password">Contraseña</label>
              <div class="input-icon"><AppIcon name="lock" :size="16" /><input id="password" v-model="form.password" type="password" required :autocomplete="registering ? 'new-password' : 'current-password'" :aria-invalid="Boolean(errors.password)" :aria-describedby="errors.password ? 'password-error' : registering ? 'password-help' : undefined" /></div>
              <p v-if="registering" id="password-help" class="field-help">De 12 a 72 caracteres y hasta 72 bytes UTF-8.</p>
              <p v-if="errors.password" id="password-error" class="field-error">{{ errors.password }}</p>
            </div>
            <div v-if="!registering && otpRequired" class="form-field otp-step">
              <p class="otp-title"><AppIcon name="key" :size="16" /> Verificación en dos pasos</p>
              <label for="login-otp">Código de verificación</label>
              <input id="login-otp" v-model="otp" class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="000000" :aria-invalid="Boolean(errors.otp)" aria-describedby="login-otp-help" />
              <p id="login-otp-help" :class="errors.otp ? 'field-error' : 'field-help'">{{ errors.otp || 'Usa el código actual de tu aplicación autenticadora. Cada código se puede usar una sola vez.' }}</p>
            </div>
            <button class="primary-button auth-submit" type="submit">{{ busy ? 'Procesando…' : registering ? 'Crear cuenta' : 'Ingresar' }}</button>
          </fieldset>
          <p v-if="retrySeconds" class="info-notice" role="status">Puedes intentar nuevamente en {{ retrySeconds }} segundos.</p>
          <p v-if="message" class="form-error" role="alert">{{ message }}</p>
        </form>
        <p class="auth-switch">{{ registering ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?' }} <RouterLink class="text-link" :to="{ name: registering ? 'login' : 'register', query: { redirect: safeRedirect(route.query.redirect) } }">{{ registering ? 'Ya tengo una cuenta' : 'Crear una cuenta' }}</RouterLink></p>
        <p class="auth-security"><AppIcon name="lock" :size="14" /> Acceso protegido con JWT stateless y cifrado AES-256-GCM del segundo factor.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-layout { display: grid; grid-template-columns: 1fr 1fr; min-height: 100svh; }
.auth-aside { position: relative; display: flex; flex-direction: column; gap: 28px; padding: 36px clamp(24px, 4vw, 56px) 0; background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 55%, #ffffff 100%); overflow: hidden; border-right: 1px solid var(--cc-border); }
.auth-copy { max-width: 520px; }
.auth-headline { font-size: clamp(26px, 3vw, 36px); line-height: 1.15; font-weight: 800; letter-spacing: -.02em; color: var(--cc-navy-strong); margin: 0 0 12px; }
.auth-lead { color: var(--cc-text-2); font-size: 15.5px; margin-bottom: 22px; }
.auth-pillars { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
.auth-pillars li { display: flex; gap: 12px; align-items: flex-start; }
.auth-pillars li > span:last-child { display: grid; gap: 2px; font-size: 13.5px; color: var(--cc-text-2); }
.auth-pillars strong { color: var(--cc-text); font-size: 14.5px; }
.pillar-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: #fff; color: var(--cc-navy); border: 1px solid var(--cc-soft-border); box-shadow: var(--cc-shadow); flex: none; }
.auth-photo { margin-top: auto; position: relative; margin-inline: calc(-1 * clamp(24px, 4vw, 56px)); }
.auth-photo::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 45%; background: linear-gradient(180deg, #f8fafc 0%, rgba(248, 250, 252, 0) 100%); z-index: 1; }
.auth-photo img { display: block; width: 100%; height: auto; max-height: 340px; object-fit: cover; object-position: center 60%; }
.auth-panel { display: grid; place-items: center; padding: 40px 24px; background: var(--cc-canvas); }
.auth-card { width: min(100%, 440px); background: #fff; border: 1px solid var(--cc-border); border-radius: 16px; box-shadow: var(--cc-shadow-lg); padding: 28px; }
.auth-card h1 { font-size: 24px; margin-top: 18px; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #f1f5f9; border-radius: 10px; padding: 4px; gap: 4px; }
.auth-tabs a { text-align: center; padding: 8px 10px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; color: var(--cc-text-2); }
.auth-tabs a.active { background: #fff; color: var(--cc-navy); box-shadow: var(--cc-shadow); }
.input-icon { position: relative; }
.input-icon svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--cc-text-3); pointer-events: none; }
.input-icon input { padding-left: 36px; }
.otp-step { background: var(--cc-soft); border: 1px solid var(--cc-soft-border); border-radius: var(--cc-radius-sm); padding: 12px; }
.otp-title { display: flex; gap: 6px; align-items: center; font-weight: 650; color: var(--cc-navy); margin: 0 0 8px; font-size: 14px; }
.otp-input { letter-spacing: .35em; font-size: 18px !important; text-align: center; }
.auth-submit { width: 100%; padding: 12px; font-size: 15px; margin-top: 4px; }
.auth-switch { font-size: 14px; color: var(--cc-text-2); margin: 16px 0 0; }
.auth-switch .text-link { margin: 0; }
.auth-security { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--cc-text-3); margin: 14px 0 0; padding-top: 14px; border-top: 1px solid var(--cc-border); }
@media (max-width: 900px) {
  .auth-layout { grid-template-columns: 1fr; }
  .auth-aside { padding-top: 24px; border-right: 0; gap: 18px; }
  .auth-pillars, .auth-lead { display: none; }
  .auth-photo img { max-height: 180px; }
  .auth-panel { padding: 20px 16px 32px; }
  .auth-card { padding: 22px 18px; }
}
</style>
