import test from 'node:test'
import assert from 'node:assert/strict'
import { benchmarkStatus, loadBenchmarkStatus } from '../src/simulations/benchmarks.js'

const rate = (overrides = {}) => ({ bankCode: 'BCP', dataSource: 'LIVE', fallbackActive: false, asOfDate: '2026-11-24', ...overrides })

test('QA-02: tasas del proveedor externo se muestran EN VIVO', () => {
  const status = benchmarkStatus([rate(), rate({ bankCode: 'IBK' })])
  assert.equal(status.state, 'live')
  assert.equal(status.label, 'EN VIVO')
  assert.equal(status.asOfDate, '2026-11-24')
})

test('QA-02: con el circuito abierto se muestra RESPALDO SBS', () => {
  assert.equal(benchmarkStatus([rate({ dataSource: 'FALLBACK_CACHED', fallbackActive: true })]).label, 'RESPALDO SBS')
  assert.equal(benchmarkStatus([rate(), rate({ fallbackActive: true })]).state, 'fallback')
  assert.equal(benchmarkStatus([rate({ dataSource: 'FALLBACK_CACHED' })]).state, 'fallback')
})

test('QA-02: sin datos válidos el indicador no se muestra y un error de red se ignora en silencio', async () => {
  assert.equal(benchmarkStatus([]), null)
  assert.equal(benchmarkStatus(null), null)
  assert.equal(benchmarkStatus({ message: 'error' }), null)
  assert.equal(benchmarkStatus([rate({ asOfDate: 'no-date' })]).asOfDate, '')
  assert.equal(await loadBenchmarkStatus({ fetchRates: async () => { throw new Error('offline') } }), null)
  assert.equal((await loadBenchmarkStatus({ fetchRates: async () => [rate({ fallbackActive: true })] })).state, 'fallback')
})
