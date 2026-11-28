import test from 'node:test'
import assert from 'node:assert/strict'
import { DISTRICT_PHOTOS, detectDistrict, propertyImage, stableHash } from '../src/properties/images.js'
import { compactAmount, shortRate, niceScale, paymentSeries } from '../src/simulations/chart.js'

test('fotos locales: el distrito detectado en dirección, título o etiquetas decide la imagen', () => {
  assert.equal(propertyImage({ address: 'Av. Larco 123, Miraflores' }), '/images/prop-miraflores.jpg')
  assert.equal(propertyImage({ title: 'Depa en Santiago de Surco' }), '/images/prop-surco.jpg')
  assert.equal(propertyImage({ address: 'Calle Las Begonias, SAN ISIDRO' }), '/images/prop-san-isidro.jpg')
  assert.equal(propertyImage({ tags: ['san borja', 'terraza'] }), '/images/prop-san-borja.jpg')
  assert.equal(propertyImage({ address: 'Jr. Cuba, Jesús María' }), '/images/prop-jesus-maria.jpg')
  assert.equal(propertyImage({ address: 'Jesus Maria' }), '/images/prop-jesus-maria.jpg')
  assert.equal(propertyImage({ description: 'Frente al malecón de Barranco' }), '/images/prop-barranco.jpg')
  assert.equal(detectDistrict({ address: 'La Molina' }), null)
})

test('fotos locales: distritos no reconocidos usan un hash estable del id y nunca URLs externas', () => {
  const a = propertyImage({ id: '7b0c2f0e-1111-4c5e-9a0a-000000000001', address: 'La Molina' })
  assert.equal(a, propertyImage({ id: '7b0c2f0e-1111-4c5e-9a0a-000000000001', address: 'Otra dirección' }))
  assert.ok(DISTRICT_PHOTOS.some(([, path]) => path === a))
  const used = new Set(Array.from({ length: 60 }, (_, i) => propertyImage({ id: `id-${i}` })))
  assert.ok(used.size >= 4, 'el hash reparte las fotos')
  assert.equal(stableHash('credicasa'), stableHash('credicasa'))
  for (const [, path] of DISTRICT_PHOTOS) assert.match(path, /^\/images\/prop-[a-z-]+\.jpg$/)
  assert.ok(propertyImage({}).startsWith('/images/'))
})

const row = (n, principal, interest) => ({ installmentNumber: n, principalAmortization: principal, interest })

test('gráfico: plazos de hasta 24 cuotas se muestran mes a mes', () => {
  const series = paymentSeries(Array.from({ length: 12 }, (_, i) => row(i + 1, '800.00', '100.50')))
  assert.equal(series.grouping, 'month')
  assert.equal(series.buckets.length, 12)
  assert.deepEqual(series.buckets[0], { label: '1', from: 1, to: 1, principal: 800, interest: 100.5, total: 900.5 })
})

test('gráfico: plazos mayores se agrupan por año y suman capital e intereses', () => {
  const series = paymentSeries(Array.from({ length: 30 }, (_, i) => row(i + 1, '10.00', '1.25')))
  assert.equal(series.grouping, 'year')
  assert.equal(series.buckets.length, 3)
  assert.deepEqual(series.buckets.map(b => [b.label, b.from, b.to, b.principal, b.interest]), [['Año 1', 1, 12, 120, 15], ['Año 2', 13, 24, 120, 15], ['Año 3', 25, 30, 60, 7.5]])
  assert.deepEqual(paymentSeries([]), { grouping: 'month', buckets: [] })
  assert.equal(paymentSeries([row(1, 'x', '-5')]).buckets[0].total, 0)
})

test('gráfico: escala del eje y montos compactos', () => {
  assert.deepEqual(niceScale(950), { max: 1000, ticks: [0, 250, 500, 750, 1000] })
  assert.equal(niceScale(0).max, 1)
  assert.equal(compactAmount(1_250_000), '1.3 M')
  assert.equal(compactAmount(24_500), '24.5 k')
  assert.equal(compactAmount(980), '980')
})

test('shortRate redondea la tasa porcentual sin alterar formatRate', () => {
  assert.equal(shortRate('0.0950000019457013308594'), '9.5 %')
  assert.equal(shortRate('0.00759153442905826452817', 6), '0.759153 %')
  assert.equal(shortRate('0.12747431', 6), '12.747431 %')
  assert.equal(shortRate('-0.01'), '-1 %')
  assert.equal(shortRate(null), 'Tasa no disponible')
})
