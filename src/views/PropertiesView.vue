<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { getProfile } from '../account/api.js'
import { session } from '../account/session.js'
import { createProperty, deleteProperty, listProperties } from '../properties/api.js'
import { formatPrice, parseTags, propertyPayload, validateProperty, validateTags } from '../properties/model.js'

const draft = reactive({ q: '', tags: '', mine: false })
const applied = reactive({ q: '', tags: [], mine: false })
const catalog = ref({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })
const loading = ref(false)
const listError = ref('')
const filterError = ref('')
const identityError = ref('')
const notice = ref('')
const emptyForm = () => ({ title: '', address: '', description: '', price: '', currency: 'PEN', tags: '' })
const form = reactive(emptyForm())
const showForm = ref(false)
const creating = ref(false)
const formErrors = ref({})
const formError = ref('')
const selected = ref(null)
const deleting = ref(false)
const deleteError = ref('')
const dialog = ref(null)
let deleteTrigger
let requestSequence = 0
let disposed = false
const ownId = computed(() => session.user?.id)

async function loadIdentity() {
  identityError.value = ''
  try {
    const profile = await getProfile()
    if (!disposed) session.user = profile
  } catch (error) {
    if (!disposed) identityError.value = `No se pudo identificar tus inmuebles. ${error.message}`
  }
}
async function load(page = catalog.value.page) {
  const sequence = ++requestSequence
  loading.value = true
  listError.value = ''
  try {
    const result = await listProperties({ ...applied, page, size: catalog.value.size })
    if (disposed || sequence !== requestSequence) return
    if (result.page > 0 && result.page >= result.totalPages) {
      await load(Math.max(0, result.totalPages - 1))
      return
    }
    catalog.value = result
  } catch (error) {
    if (!disposed && sequence === requestSequence) listError.value = error.message
  } finally {
    if (!disposed && sequence === requestSequence) loading.value = false
  }
}
async function applyFilters() {
  const tags = parseTags(draft.tags)
  filterError.value = draft.q.trim().length > 120 ? 'La búsqueda admite hasta 120 caracteres.' : validateTags(tags)
  if (filterError.value) return
  Object.assign(applied, { q: draft.q.trim(), tags, mine: draft.mine })
  await load(0)
}
async function clearFilters() {
  Object.assign(draft, { q: '', tags: '', mine: false })
  await applyFilters()
}
async function removeTag(tag) {
  draft.tags = applied.tags.filter(value => value !== tag).join(', ')
  await applyFilters()
}
async function submitProperty() {
  if (creating.value) return
  formErrors.value = validateProperty(form)
  formError.value = ''
  notice.value = ''
  if (Object.keys(formErrors.value).length) { formError.value = 'Revisa los campos indicados. No se registró el inmueble.'; return }
  creating.value = true
  try {
    await createProperty(propertyPayload(form))
    if (disposed) return
    Object.assign(form, emptyForm())
    showForm.value = false
    notice.value = 'Inmueble registrado. Se conservaron tus filtros; el registro aparecerá si coincide con ellos.'
    await load()
  } catch (error) {
    if (!disposed) { formErrors.value = error.validationErrors || {}; formError.value = error.message }
  } finally { creating.value = false }
}
async function askDelete(property, event) {
  if (!ownId.value || property.ownerId !== ownId.value || deleting.value) return
  selected.value = property
  deleteError.value = ''
  deleteTrigger = event.currentTarget
  await nextTick()
  dialog.value.showModal()
}
function cancelDelete() {
  if (deleting.value) return
  dialog.value?.close()
  selected.value = null
  deleteTrigger?.focus()
}
async function confirmDelete() {
  if (!selected.value || deleting.value || selected.value.ownerId !== ownId.value) return
  deleting.value = true
  deleteError.value = ''
  notice.value = ''
  try {
    await deleteProperty(selected.value.id)
    if (disposed) return
    dialog.value.close()
    selected.value = null
    notice.value = 'Inmueble eliminado.'
    await load()
    await nextTick()
    document.getElementById('catalog-heading')?.focus()
  } catch (error) {
    if (!disposed) deleteError.value = error.status === 403 ? 'Solo el propietario puede eliminar este inmueble.' : error.status === 404 ? 'El inmueble ya no está disponible. Cancela y actualiza el listado.' : error.message
  } finally { deleting.value = false }
}
onMounted(() => { loadIdentity(); load(0) })
onUnmounted(() => { disposed = true; requestSequence++; dialog.value?.close() })
</script>

<template>
  <section aria-labelledby="page-title" class="property-page">
    <div class="section-heading">
      <h1 id="page-title">Inmobiliario</h1>
      <button class="primary-button" type="button" :disabled="creating" @click="showForm = !showForm">{{ showForm ? 'Ocultar registro' : 'Registrar inmueble' }}</button>
    </div>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <section v-if="showForm" class="content-card property-registration" aria-labelledby="registration-heading">
      <h2 id="registration-heading">Registrar inmueble</h2>
      <form class="account-form" novalidate :aria-busy="creating" @submit.prevent="submitProperty">
        <fieldset :disabled="creating">
          <div v-for="field in [{ key: 'title', label: 'Título', max: 120 }, { key: 'address', label: 'Dirección', max: 250 }]" :key="field.key" class="form-field">
            <label :for="`property-${field.key}`">{{ field.label }}</label>
            <input :id="`property-${field.key}`" v-model="form[field.key]" required :maxlength="field.max" :aria-invalid="Boolean(formErrors[field.key])" :aria-describedby="formErrors[field.key] ? `property-${field.key}-error` : undefined" />
            <p v-if="formErrors[field.key]" :id="`property-${field.key}-error`" class="field-error">{{ formErrors[field.key] }}</p>
          </div>
          <div class="form-field">
            <label for="property-description">Descripción (opcional)</label>
            <textarea id="property-description" v-model="form.description" rows="3" maxlength="2000" :aria-invalid="Boolean(formErrors.description)" aria-describedby="description-error" />
            <p v-if="formErrors.description" id="description-error" class="field-error">{{ formErrors.description }}</p>
          </div>
          <div class="property-price-fields">
            <div class="form-field">
              <label for="property-price">Precio</label>
              <input id="property-price" v-model="form.price" type="text" inputmode="decimal" required aria-describedby="price-help price-error" :aria-invalid="Boolean(formErrors.price)" />
              <p id="price-help" class="field-help">Mayor que cero. Usa punto decimal, sin separadores de miles.</p>
              <p v-if="formErrors.price" id="price-error" class="field-error">{{ formErrors.price }}</p>
            </div>
            <div class="form-field">
              <label for="property-currency">Moneda</label>
              <select id="property-currency" v-model="form.currency" required :aria-invalid="Boolean(formErrors.currency)"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select>
              <p v-if="formErrors.currency" class="field-error">{{ formErrors.currency }}</p>
            </div>
          </div>
          <div class="form-field">
            <label for="property-tags">Etiquetas (opcional)</label>
            <input id="property-tags" v-model="form.tags" aria-describedby="property-tags-help property-tags-error" :aria-invalid="Boolean(formErrors.tags)" />
            <p id="property-tags-help" class="field-help">Separa con comas: con terraza, estacionamiento. Máximo 20 etiquetas de 40 caracteres.</p>
            <p v-if="formErrors.tags" id="property-tags-error" class="field-error">{{ formErrors.tags }}</p>
          </div>
          <button class="primary-button" type="submit">{{ creating ? 'Registrando…' : 'Guardar inmueble' }}</button>
        </fieldset>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      </form>
    </section>
    <section class="content-card property-filters" aria-labelledby="filters-heading">
      <h2 id="filters-heading">Buscar inmuebles</h2>
      <form class="account-form" novalidate @submit.prevent="applyFilters">
        <div class="form-field"><label for="property-query">Buscar por título, dirección o descripción</label><input id="property-query" v-model="draft.q" type="search" maxlength="120" /></div>
        <div class="form-field"><label for="filter-tags">Etiquetas requeridas</label><input id="filter-tags" v-model="draft.tags" aria-describedby="filter-tags-help" /><p id="filter-tags-help" class="field-help">Separa con comas. Los resultados deben cumplir todas las etiquetas.</p></div>
        <label class="checkbox-label"><input v-model="draft.mine" type="checkbox" /> Solo mis inmuebles</label>
        <div class="property-actions"><button class="primary-button" type="submit" :disabled="loading">Aplicar filtros</button><button class="text-button" type="button" :disabled="loading" @click="clearFilters">Limpiar filtros</button></div>
        <p v-if="filterError" class="form-error" role="alert">{{ filterError }}</p>
      </form>
      <ul v-if="applied.tags.length" class="tag-list" aria-label="Etiquetas aplicadas"><li v-for="tag in applied.tags" :key="tag"><button type="button" :disabled="loading" @click="removeTag(tag)" :aria-label="`Retirar etiqueta ${tag}`">{{ tag }} ×</button></li></ul>
    </section>
    <div v-if="identityError" class="form-error" role="alert"><p>{{ identityError }}</p><button class="text-button" type="button" @click="loadIdentity">Reintentar identificación</button></div>
    <section aria-labelledby="catalog-heading" :aria-busy="loading">
      <h2 id="catalog-heading" tabindex="-1">Catálogo de inmuebles</h2>
      <p v-if="loading" role="status">Cargando inmuebles…</p>
      <div v-else-if="listError" role="alert"><p class="form-error">{{ listError }}</p><button class="text-button" type="button" @click="load()">Reintentar consulta</button></div>
      <template v-else>
        <p v-if="!catalog.items.length" role="status">No hay inmuebles que coincidan con los filtros.</p>
        <p v-else class="field-help">{{ catalog.totalElements }} inmuebles encontrados.</p>
        <ul class="property-grid">
          <li v-for="property in catalog.items" :key="property.id" class="content-card property-card">
            <h3>{{ property.title }}</h3><p>{{ property.address }}</p><p class="property-price">{{ formatPrice(property.price, property.currency) }}</p>
            <p v-if="property.description" class="property-description">{{ property.description }}</p>
            <ul v-if="property.tags.length" class="tag-list" aria-label="Etiquetas del inmueble"><li v-for="tag in property.tags" :key="tag">{{ tag }}</li></ul>
            <p v-if="ownId && property.ownerId === ownId" class="field-help">Tu inmueble</p>
            <button v-if="ownId && property.ownerId === ownId" class="text-button" type="button" @click="askDelete(property, $event)" :aria-label="`Eliminar ${property.title}`">Eliminar</button>
          </li>
        </ul>
        <nav v-if="catalog.totalPages > 1" class="property-pagination" aria-label="Paginación de inmuebles"><button class="primary-button" type="button" :disabled="catalog.page === 0" @click="load(catalog.page - 1)">Anterior</button><span>Página {{ catalog.page + 1 }} de {{ catalog.totalPages }}</span><button class="primary-button" type="button" :disabled="catalog.page + 1 >= catalog.totalPages" @click="load(catalog.page + 1)">Siguiente</button></nav>
      </template>
    </section>
    <dialog ref="dialog" class="delete-dialog" aria-labelledby="delete-heading" aria-describedby="delete-description" @cancel.prevent="cancelDelete">
      <h2 id="delete-heading">Eliminar inmueble</h2>
      <p id="delete-description">¿Quieres eliminar «{{ selected?.title }}» del catálogo? Esta acción no se puede deshacer.</p>
      <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
      <div class="property-actions"><button class="primary-button" type="button" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Eliminando…' : 'Confirmar eliminación' }}</button><button class="text-button" type="button" :disabled="deleting" autofocus @click="cancelDelete">Cancelar</button></div>
    </dialog>
  </section>
</template>
