<script setup>
// Inicio: dashboard real para usuarios autenticados (carga no bloqueante y tolerante a fallos) o bienvenida pública.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { session } from '../../../account/session.js'
import { listProperties } from '../../../properties/api.js'
import { formatPrice } from '../../../properties/model.js'
import { propertyImage, propertyImageAlt, HERO_PHOTO } from '../../../properties/images.js'
import { listSimulations } from '../../../simulations/scenarios.js'
import { listOffers } from '../../../offers/api.js'
import { notificationFeed as feed } from '../../../notifications/feed.js'
import AppIcon from '../components/AppIcon.vue'
import BrandLogo from '../components/BrandLogo.vue'

const authed = computed(() => Boolean(session.token))
const stats = ref({ properties: null, simulations: null, offers: null })
const featured = ref([])
let disposed = false
const firstName = computed(() => session.user?.firstName || '')

const kpis = computed(() => [
  { key: 'properties', label: 'Inmuebles en catálogo', icon: 'building', tone: 'kpi-blue', to: '/realState', value: stats.value.properties },
  { key: 'simulations', label: 'Simulaciones guardadas', icon: 'calculator', tone: 'kpi-sky', to: '/simulations', value: stats.value.simulations },
  { key: 'offers', label: 'Ofertas recibidas', icon: 'file', tone: 'kpi-indigo', to: '/offers', value: stats.value.offers },
  { key: 'unread', label: 'Avisos sin leer', icon: 'bell', tone: 'kpi-green', to: '/notifications', value: feed.state.unreadCount },
])
const actions = [
  { to: '/simulations', icon: 'calculator', title: 'Simular crédito', text: 'TEA o TNA con capitalización, gracia, balón y seguros.', tag: 'US19' },
  { to: '/simulations/compare', icon: 'compare', title: 'Comparar escenarios', text: 'Hasta 3 escenarios lado a lado, con prepago opcional.', tag: 'US20' },
  { to: '/realState', icon: 'shield', title: 'Catálogo SUNARP', text: 'Busca inmuebles y valida la partida registral.', tag: 'US07 · US09' },
  { to: '/offers', icon: 'layers', title: 'Ofertas y versiones', text: 'Revisa versiones inmutables y exporta PDF o XLSX.', tag: 'US21 · US22' },
  { to: '/notifications', icon: 'message', title: 'Mensajería privada', text: 'Conversa con asesores sobre un inmueble.', tag: 'US16' },
]

async function settle(promise, apply) {
  try { const value = await promise; if (!disposed) apply(value) } catch { /* El dashboard tolera fallos de cada métrica. */ }
}
onMounted(() => {
  if (!authed.value) return
  settle(listProperties({ q: '', tags: [], mine: false, page: 0, size: 3 }), value => { stats.value.properties = value.totalElements ?? value.items?.length ?? 0; featured.value = (value.items || []).slice(0, 3) })
  settle(listSimulations({ page: 0, size: 1 }), value => { stats.value.simulations = value.totalElements })
  settle(listOffers({ page: 0, size: 1 }), value => { stats.value.offers = value.totalElements ?? value.items?.length ?? 0 })
})
onUnmounted(() => { disposed = true })
</script>

<template>
  <section v-if="authed" class="dashboard" aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">Panel de control</p>
        <h1 id="page-title">{{ firstName ? `Hola, ${firstName}` : 'Inicio' }}</h1>
        <p class="page-subtitle">Este es el resumen de tu actividad en CrediCasa.</p>
      </div>
      <RouterLink class="primary-button" to="/simulations"><AppIcon name="calculator" :size="16" /> Nueva simulación</RouterLink>
    </div>

    <ul class="kpi-grid dashboard-kpis" aria-label="Indicadores de tu cuenta">
      <li v-for="kpi in kpis" :key="kpi.key">
        <RouterLink class="kpi-card" :class="kpi.tone" :to="kpi.to">
          <span class="kpi-label"><AppIcon :name="kpi.icon" /> {{ kpi.label }}</span>
          <span class="kpi-value">{{ kpi.value ?? '—' }}</span>
          <span class="kpi-hint">Ver detalle <AppIcon name="arrow" :size="12" /></span>
        </RouterLink>
      </li>
    </ul>

    <h2 class="dashboard-section-title">Acciones rápidas</h2>
    <ul class="quick-actions">
      <li v-for="action in actions" :key="action.to">
        <RouterLink class="quick-action" :to="action.to">
          <span class="quick-icon"><AppIcon :name="action.icon" :size="20" /></span>
          <span class="quick-copy"><strong>{{ action.title }}</strong><span>{{ action.text }}</span></span>
          <span class="pill">{{ action.tag }}</span>
        </RouterLink>
      </li>
    </ul>

    <div class="dashboard-section-head">
      <h2 class="dashboard-section-title">Inmuebles destacados</h2>
      <RouterLink class="text-link" to="/realState">Ver catálogo completo <AppIcon name="arrow" :size="14" /></RouterLink>
    </div>
    <ul v-if="featured.length" class="featured-grid">
      <li v-for="property in featured" :key="property.id" class="content-card featured-card">
        <div class="property-photo"><img :src="propertyImage(property)" :alt="propertyImageAlt(property)" loading="lazy" width="800" height="500" /></div>
        <div class="featured-body">
          <p class="featured-title wrap-anywhere clamp-2" :title="property.title">{{ property.title }}</p>
          <p class="property-address"><AppIcon name="pin" :size="14" /> {{ property.address }}</p>
          <p class="featured-price tabular">{{ formatPrice(property.price, property.currency) }}</p>
        </div>
      </li>
    </ul>
    <p v-else class="empty-state">Aún no hay inmuebles publicados. Registra el primero desde el catálogo.</p>
  </section>

  <section v-else class="welcome" aria-labelledby="page-title">
    <div class="welcome-copy">
      <BrandLogo />
      <p class="eyebrow">Plataforma hipotecaria · Perú</p>
      <h1 id="page-title">Encuentra tu casa y entiende tu crédito antes de firmar</h1>
      <p class="page-subtitle">Simula tu crédito con las fórmulas de transparencia de la SBS, compara escenarios y revisa inmuebles verificados en SUNARP.</p>
      <div class="welcome-actions">
        <RouterLink class="primary-button" to="/login">Iniciar sesión</RouterLink>
        <RouterLink class="secondary-button" to="/register">Crear cuenta</RouterLink>
      </div>
      <p class="field-help">Las ofertas y tasas mostradas son de demostración y no constituyen una aprobación bancaria.</p>
    </div>
    <div class="welcome-photo"><img :src="HERO_PHOTO" alt="Casa moderna con detalles azul marino" width="1280" height="714" /></div>
  </section>
</template>

<style scoped>
.dashboard-kpis { list-style: none; padding: 0; margin: 0 0 28px; }
.dashboard-kpis .kpi-card { height: 100%; }
.kpi-hint { display: inline-flex; align-items: center; gap: 4px; }
.dashboard-section-title { font-size: 16px; margin: 0 0 12px; }
.dashboard-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 28px; }
.dashboard-section-head .text-link { margin: 0; }
.quick-actions { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 14px; }
.quick-action { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 10px 12px; height: 100%; padding: 16px; background: #fff; border: 1px solid var(--cc-border); border-radius: var(--cc-radius); box-shadow: var(--cc-shadow); text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; }
.quick-action:hover { border-color: var(--cc-soft-border); box-shadow: var(--cc-shadow-lg); }
.quick-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--cc-soft); color: var(--cc-navy); border: 1px solid var(--cc-soft-border); }
.quick-copy { display: grid; gap: 2px; font-size: 13px; color: var(--cc-text-2); }
.quick-copy strong { font-size: 14.5px; color: var(--cc-text); }
.quick-action .pill { grid-column: 1 / -1; justify-self: start; }
.featured-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 16px; }
.featured-card { padding: 0; overflow: hidden; }
.featured-body { padding: 14px 16px; }
.featured-title { font-weight: 650; margin: 0 0 4px; line-height: 1.35; }
.featured-body { min-width: 0; }
.featured-body .property-address, .featured-body p { overflow-wrap: anywhere; word-break: break-word; }
.featured-price { font-size: 18px; font-weight: 750; color: var(--cc-navy-strong); margin: 0; }
.welcome { display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; padding: 24px 0; }
.welcome-copy { display: grid; gap: 14px; justify-items: start; }
.welcome-copy h1 { font-size: clamp(28px, 4vw, 42px); color: var(--cc-navy-strong); margin: 0; }
.welcome-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.welcome-photo img { width: 100%; height: auto; border-radius: 18px; box-shadow: var(--cc-shadow-lg); display: block; }
@media (max-width: 900px) { .welcome { grid-template-columns: 1fr; gap: 24px; } }
</style>
