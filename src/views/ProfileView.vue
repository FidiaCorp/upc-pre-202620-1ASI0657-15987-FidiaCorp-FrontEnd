<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getProfile, updateProfile } from '../account/api.js'
import { session } from '../account/session.js'
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
  <section class="content-card account-card" aria-labelledby="page-title">
    <h1 id="page-title">Perfil</h1>
    <p v-if="loading" role="status">Cargando tu perfil…</p>
    <form v-else-if="loaded" class="account-form" novalidate :aria-busy="saving" @submit.prevent="save">
      <fieldset :disabled="saving">
        <div v-for="field in [{ key: 'firstName', label: 'Nombres', autocomplete: 'given-name' }, { key: 'lastName', label: 'Apellidos', autocomplete: 'family-name' }, { key: 'email', label: 'Correo electrónico', autocomplete: 'email' }]" :key="field.key" class="form-field">
          <label :for="field.key">{{ field.label }}</label>
          <input :id="field.key" v-model="form[field.key]" :type="field.key === 'email' ? 'email' : 'text'" required :maxlength="field.key === 'email' ? 254 : 100" :autocomplete="field.autocomplete" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? `${field.key}-error` : undefined" />
          <p v-if="errors[field.key]" :id="`${field.key}-error`" class="field-error">{{ errors[field.key] }}</p>
        </div>
        <button class="primary-button" type="submit">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </fieldset>
    </form>
    <p v-if="message" class="form-error" role="alert">{{ message }}</p>
    <p v-if="success" class="success-message" role="status">{{ success }}</p>
    <button v-if="!loading && !loaded" class="primary-button" type="button" @click="load">Reintentar</button>
  </section>
</template>
