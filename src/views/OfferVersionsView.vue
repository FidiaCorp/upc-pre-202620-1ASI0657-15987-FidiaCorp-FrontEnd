<script setup>
// US21 (emisor): el asesor que emitió la oferta consulta el historial y emite nuevas versiones inmutables.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import QuotationVersions from '../offers/QuotationVersions.vue'
import { isRealtor } from '../offers/versions.js'
import { sessionRoles } from '../account/session.js'
import AppIcon from '../shared/presentation/components/AppIcon.vue'
const route = useRoute()
const canIssue = computed(() => isRealtor({ roles: sessionRoles() }))
</script>
<template>
  <section aria-labelledby="page-title">
    <div class="page-header">
      <div>
        <p class="eyebrow">US21 · Versionado inmutable</p>
        <h1 id="page-title">Versiones de la oferta</h1>
        <p class="page-subtitle">Historial firmado con SHA-256. {{ canIssue ? 'Como asesor, puedes emitir una nueva versión.' : 'Solo el asesor emisor puede emitir nuevas versiones.' }}</p>
      </div>
      <RouterLink class="secondary-button" :to="`/offers/${route.params.id}`"><AppIcon name="file" :size="16" />Ir al detalle de la oferta</RouterLink>
    </div>
    <p class="demo-notice"><span class="pill demo-label">DEMO</span><span>Cada versión es inmutable; una nueva versión no modifica las anteriores.</span></p>
    <div class="content-card"><QuotationVersions :offer-id="String(route.params.id)" :can-issue="canIssue" /></div>
  </section>
</template>
