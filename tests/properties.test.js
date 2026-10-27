import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, parseTags, propertyPayload, propertyQuery, validateProperty, validateTags, validPrice } from '../src/properties/model.js'
import { createProperty, listProperties } from '../src/properties/api.js'
import { clearSession, startSession } from '../src/account/session.js'

const form = () => ({ title: ' Casa ', address: ' Lima ', description: ' Terraza ', price: '9999999999999999.99', currency: 'PEN', tags: ' TERRAZA, estacionamiento,terraza ' })

test('maximum property amount is transported and rendered without losing cents', async () => {
  const payload = propertyPayload(form())
  assert.equal(payload.price, '9999999999999999.99')
  assert.equal(formatPrice(payload.price, 'PEN'), 'S/ 9,999,999,999,999,999.99')
  assert.equal(formatPrice('0.01', 'USD'), 'US$ 0.01')
  assert.equal(formatPrice('12.1', 'PEN'), 'S/ 12.10')
  const previous = globalThis.fetch
  try {
    startSession({ token: 'property-token', expiresIn: 10000 })
    globalThis.fetch = async (_, options) => {
      const body = JSON.parse(options.body)
      assert.equal(typeof body.price, 'string')
      assert.equal(body.price, '9999999999999999.99')
      return new Response(JSON.stringify({ id: 'property', ...body }), { status: 201 })
    }
    assert.equal((await createProperty(payload)).price, '9999999999999999.99')
  } finally { globalThis.fetch = previous; clearSession() }
})
test('price validation rejects zero, exponential notation, excess digits and excess cents', () => {
  for (const price of ['0', '0.00', '-1', '1e10', '1,000.00', '1.001', '10000000000000000', 'NaN', '']) assert.equal(validPrice(price), false, price)
  assert.equal(validPrice('9999999999999999.99'), true)
  assert.equal(validPrice('0.01'), true)
  assert.equal(propertyPayload({ ...form(), price: '00001.2' }).price, '1.20')
})
test('registration rejects required blanks and invalid values while normalizing tags', () => {
  assert.deepEqual(validateProperty(form()), {})
  const invalid = validateProperty({ title: ' ', address: '', description: 'a'.repeat(2001), price: '0', currency: 'EUR', tags: 'terraza,' })
  assert.deepEqual(Object.keys(invalid).sort(), ['address', 'currency', 'description', 'price', 'tags', 'title'])
  assert.deepEqual(parseTags(' ＴＥＲＲＡＺＡ,  con   terraza ,terraza '), ['terraza', 'con terraza'])
  assert.match(validateTags(Array.from({ length: 21 }, (_, i) => `tag${i}`)), /20/)
  assert.match(validateTags(['a'.repeat(41)]), /40/)
})
test('query preserves repeated AND tags, mine and page without corrupting special characters', async () => {
  const filters = { q: 'Lima & sur', tags: ['con terraza', 'estacionamiento'], mine: true, page: 2, size: 20 }
  const query = new URLSearchParams(propertyQuery(filters))
  assert.equal(query.get('q'), 'Lima & sur')
  assert.deepEqual(query.getAll('tags'), filters.tags)
  assert.equal(query.get('mine'), 'true')
  assert.equal(query.get('page'), '2')
  const previous = globalThis.fetch
  try {
    startSession({ token: 'property-token', expiresIn: 10000 })
    globalThis.fetch = async url => {
      assert.deepEqual(new URL(url).searchParams.getAll('tags'), filters.tags)
      return new Response(JSON.stringify({ items: [], page: 2, size: 20, totalElements: 0, totalPages: 0 }))
    }
    assert.equal((await listProperties(filters)).page, 2)
  } finally { globalThis.fetch = previous; clearSession() }
})
