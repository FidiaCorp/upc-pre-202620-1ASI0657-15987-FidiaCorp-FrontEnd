import { request } from '../services/http.js'

// QA-02: indica si las tasas de referencia vienen del proveedor bancario externo (LIVE)
// o de la caché SBS de respaldo con el Circuit Breaker abierto (FALLBACK_CACHED).
export function benchmarkStatus(rates) {
  if (!Array.isArray(rates) || rates.length === 0) return null
  const fallback = rates.some(rate => rate?.fallbackActive === true || rate?.dataSource === 'FALLBACK_CACHED')
  const asOfDate = rates.map(rate => rate?.asOfDate).find(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) || ''
  return fallback
    ? { state: 'fallback', label: 'RESPALDO SBS', detail: 'Proveedor bancario externo no disponible: tasas desde la caché SBS.', asOfDate }
    : { state: 'live', label: 'EN VIVO', detail: 'Tasas obtenidas del proveedor bancario externo.', asOfDate }
}

const fetchBenchmarks = () => request('/banking/benchmarks?currency=PEN', { authenticated: false })

// Nunca lanza: si la consulta falla, el indicador simplemente no se muestra.
export async function loadBenchmarkStatus({ fetchRates = fetchBenchmarks } = {}) {
  try {
    return benchmarkStatus(await fetchRates())
  } catch {
    return null
  }
}
