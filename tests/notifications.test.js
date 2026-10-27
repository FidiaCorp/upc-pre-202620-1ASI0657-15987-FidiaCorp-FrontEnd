import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationFeed } from '../src/notifications/feed.js'
import { formatRate } from '../src/offers/format.js'

const page = (count = 1, readAt = null) => ({ items: [{ id: 'notice', offerId: 'offer', title: 'DEMO', readAt }], page: 0, size: 20, totalElements: 1, totalPages: 1, unreadCount: count })
function harness(overrides = {}) {
  const timers = new Map()
  let next = 0
  const feed = createNotificationFeed({ identity: () => 'token', fetchPage: async () => page(), markRead: async () => ({ ...page().items[0], readAt: '2026-10-27T00:00:00Z' }), schedule: (fn, delay) => { assert.equal(delay, 5000); timers.set(++next, fn); return next }, cancel: id => timers.delete(id), ...overrides })
  return { feed, timers }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('rate rendering multiplies decimal strings exactly and does not round fractional digits', () => {
  assert.equal(formatRate('0.123456789123456789'), '12.3456789123456789 %')
  assert.equal(formatRate('0.01'), '1 %')
  assert.equal(formatRate('1.0000'), '100 %')
  assert.equal(formatRate('0.000001'), '0.0001 %')
})
test('feed polls every five seconds after completion, announces new notices and stops without overlapping fetches', async () => {
  let count = 0
  const { feed, timers } = harness({ fetchPage: async () => page(++count) })
  await feed.start()
  assert.equal(count, 1)
  assert.equal(timers.size, 1)
  const tick = [...timers.values()][0]
  await tick()
  assert.equal(count, 2)
  assert.match(feed.state.announcement, /nuevas/)
  feed.stop()
  assert.equal(timers.size, 0)
  assert.equal(feed.state.unreadCount, 0)
})
test('a slow GET cannot overwrite a completed mark-read and repeated refreshes do not overlap', async () => {
  const slow = deferred()
  let calls = 0
  const { feed } = harness({ fetchPage: async () => (++calls === 2 ? slow.promise : page(calls === 1 ? 1 : 0, calls === 1 ? null : 'read')) })
  await feed.start()
  const poll = feed.refresh()
  const duplicate = feed.refresh()
  assert.equal(calls, 2)
  const reading = feed.read('notice')
  await Promise.resolve()
  assert.equal(feed.state.items[0].readAt !== null, true)
  slow.resolve(page(1))
  await Promise.all([poll, duplicate, reading])
  assert.equal(feed.state.items[0].readAt, 'read')
  assert.equal(feed.state.unreadCount, 0)
  assert.equal(calls, 3)
  feed.stop()
})
test('a poll begun during PATCH is also invalidated by its completion', async () => {
  const patch = deferred()
  const slowPoll = deferred()
  let calls = 0
  const { feed } = harness({ markRead: () => patch.promise, fetchPage: async () => (++calls === 2 ? slowPoll.promise : page(calls === 1 ? 1 : 0, calls === 1 ? null : 'read')) })
  await feed.start()
  const marking = feed.read('notice')
  const polling = feed.refresh()
  patch.resolve({ ...page().items[0], readAt: 'read' })
  await Promise.resolve()
  slowPoll.resolve(page(1))
  await Promise.all([marking, polling])
  assert.equal(feed.state.unreadCount, 0)
  assert.equal(feed.state.items[0].readAt, 'read')
  feed.stop()
})
test('pause preserves the displayed state; logout discards delayed responses and new identity stays isolated', async () => {
  const slow = deferred()
  let token = 'first'
  let calls = 0
  const { feed, timers } = harness({ identity: () => token, fetchPage: async () => (++calls === 2 ? slow.promise : page(2)) })
  await feed.start()
  feed.stop(false)
  assert.equal(feed.state.unreadCount, 2)
  assert.equal(timers.size, 0)
  const restarting = feed.start()
  await Promise.resolve()
  feed.stop()
  token = 'second'
  const nextStart = feed.start()
  slow.resolve(page(99))
  await Promise.all([restarting, nextStart])
  assert.equal(feed.state.unreadCount, 2)
  assert.equal(timers.size, 1)
  feed.stop()
})
test('notification errors remain retryable without falsely marking a notice read', async () => {
  let fail = true
  const { feed } = harness({ markRead: async () => { throw new Error('Not allowed') }, fetchPage: async () => { if (fail) throw new Error('Offline'); return page() } })
  await feed.start()
  assert.equal(feed.state.error, 'Offline')
  fail = false
  await feed.refresh()
  assert.equal(feed.state.error, '')
  await feed.read('notice')
  assert.equal(feed.state.error, 'Not allowed')
  assert.equal(feed.state.items[0].readAt, null)
  feed.stop()
})
