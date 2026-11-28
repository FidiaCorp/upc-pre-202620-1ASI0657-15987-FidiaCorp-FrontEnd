<script setup>
// Isotipo CrediCasa: casa geométrica con barras financieras ascendentes.
defineProps({ compact: { type: Boolean, default: false } })
</script>
<template>
  <span class="brand-inner">
    <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#174B85" />
      <path d="M8 19.5 20 9.5l12 10" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="12" y="23" width="4" height="7" rx="1" fill="#93C5FD" />
      <rect x="18" y="20" width="4" height="10" rx="1" fill="#BFDBFE" />
      <rect x="24" y="17" width="4" height="13" rx="1" fill="#fff" />
    </svg>
    <span v-if="!compact" class="brand-text"><span class="brand-name">CrediCasa</span><span class="brand-sub">by FidiaCorp</span></span>
  </span>
</template>
<style scoped>
.brand-inner { display: inline-flex; align-items: center; gap: 10px; }
</style>
