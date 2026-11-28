<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getProfile, updateProfile } from '../account/api.js'
import LogoutButton from '../account/LogoutButton.vue'
import TwoFactorSettings from '../account/TwoFactorSettings.vue'
import SubscriptionStatusCard from '../subscriptions/SubscriptionStatusCard.vue'
import { session } from '../account/session.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
import { normalizeProfile, validateAccount } from '../account/validation.js'

const form = reactive({ firstName: '', lastName: '', email: '' })
const loading = ref(true)
const saving = ref(false)
const loaded = ref(false)
const message = ref('')
const success = ref('')
const errors = ref({})
function applyProfile(profile) {
  session.user = profile
  Object.assign(form, { firstName: profile.firstName, lastName: profile.lastName, email: profile.email })
}
async function load() {
  loading.value = true
  message.value = ''
  try { applyProfile(await getProfile()); loaded.value = true } catch (error) { message.value = error.message } finally { loading.value = false }
}
async function save() {
  if (saving.value) return
  success.value = ''
  message.value = ''
  errors.value = validateAccount(form, { names: true })
  if (Object.keys(errors.value).length) { message.value = 'Revisa los campos indicados. No se guardaron los cambios.'; return }
  saving.value = true
  try {
    applyProfile(await updateProfile(normalizeProfile(form)))
    success.value = 'Tu perfil se actualizó correctamente.'
  } catch (error) {
    errors.value = error.validationErrors || {}
    message.value = error.status === 409 ? 'Este correo ya pertenece a otra cuenta.' : error.message
  } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <section class="profile-page" aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">US03 · US04 · Cuenta</p>
        <h1 id="page-title">Perfil y seguridad</h1>
        <p class="page-subtitle">Administra tus datos, el segundo factor de autenticación y tu plan de suscripción.</p>
      </div>
    </div>
    <p v-if="loading" role="status">Cargando tu perfil…</p>
    <div class="profile-grid">
      <div class="profile-column">
        <section class="content-card" aria-labelledby="profile-data-title">
          <h2 id="profile-data-title"><AppIcon name="user" :size="18" /> Datos personales</h2>
          <form v-if="loaded" class="account-form" novalidate :aria-busy="saving" @submit.prevent="save">
            <fieldset :disabled="saving">
              <div class="form-grid-2">
                <div v-for="field in [{ key: 'firstName', label: 'Nombres', autocomplete: 'given-name' }, { key: 'lastName', label: 'Apellidos', autocomplete: 'family-name' }]" :key="field.key" class="form-field">
                  <label :for="field.key">{{ field.label }}</label>
                  <input :id="field.key" v-model="form[field.key]" type="text" required maxlength="100" :autocomplete="field.autocomplete" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? `${field.key}-error` : undefined" />
                  <p v-if="errors[field.key]" :id="`${field.key}-error`" class="field-error">{{ errors[field.key] }}</p>
                </div>
              </div>
              <div class="form-field">
                <label for="email">Correo electrónico</label>
                <input id="email" v-model="form.email" type="email" required maxlength="254" autocomplete="email" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'email-error' : undefined" />
                <p v-if="errors.email" id="email-error" class="field-error">{{ errors.email }}</p>
              </div>
              <div class="profile-actions"><button class="primary-button" type="submit">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button><LogoutButton /></div>
            </fieldset>
          </form>
          <p v-if="message" class="form-error" role="alert">{{ message }}</p>
          <p v-if="success" class="success-message" role="status">{{ success }}</p>
          <button v-if="!loading && !loaded" class="primary-button" type="button" @click="load">Reintentar</button>
        </section>
        <section v-if="loaded" class="content-card"><TwoFactorSettings /></section>
      </div>
      <div class="profile-column">
        <SubscriptionStatusCard v-if="loaded" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.profile-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.profile-column { display: grid; gap: 20px; min-width: 0; }
.profile-column > .content-card { margin: 0; }
.profile-column h2 { display: flex; align-items: center; gap: 8px; margin-top: 0; }
.profile-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
@media (max-width: 1100px) { .profile-grid { grid-template-columns: 1fr; } }
</style>
