import { reactive } from 'vue'
import { session } from '../account/session.js'
import { listNotifications, markNotificationRead } from '../offers/api.js'

export function createNotificationFeed({ fetchPage = listNotifications, markRead = markNotificationRead, identity = () => session.token, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const state = reactive({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0, unreadCount: 0, unreadOnly: false, loading: false, error: '', announcement: '', reading: null })
  let running = false
  let timer
  let epoch = 0
  let revision = 0
  let pending = null
  let initialized = false
  function stop(clear = true) {
    running = false
    epoch++
    cancel(timer)
    timer = null
    state.loading = false
    state.reading = null
    if (clear) {
      initialized = false
      Object.assign(state, { items: [], page: 0, totalElements: 0, totalPages: 0, unreadCount: 0, unreadOnly: false, error: '', announcement: '', reading: null })
    }
  }
  async function refresh() {
    if (!running || !identity()) return
    if (pending) return pending
    const ownEpoch = epoch
    const ownRevision = revision
    const ownIdentity = identity()
    state.loading = true
    pending = (async () => {
      try {
        let result = await fetchPage({ page: state.page, size: state.size, unreadOnly: state.unreadOnly })
        if (running && ownEpoch === epoch && ownRevision === revision && identity() === ownIdentity && result.page > 0 && result.page >= result.totalPages) {
          result = await fetchPage({ page: Math.max(0, result.totalPages - 1), size: state.size, unreadOnly: state.unreadOnly })
        }
        if (!running || ownEpoch !== epoch || ownRevision !== revision || identity() !== ownIdentity) return
        if (initialized && result.unreadCount > state.unreadCount) state.announcement = 'Tienes nuevas notificaciones de ofertas de demostración.'
        if (!result.unreadCount) state.announcement = ''
        Object.assign(state, result, { error: '' })
        initialized = true
      } catch (error) {
        if (running && ownEpoch === epoch && ownRevision === revision && identity() === ownIdentity) state.error = error.message
      } finally {
        if (ownEpoch === epoch) state.loading = false
        pending = null
      }
    })()
    return pending
  }
  function scheduleNext() {
    cancel(timer)
    if (running && identity()) timer = schedule(async () => { await refresh(); scheduleNext() }, 5000)
  }
  async function start() {
    if (running || !identity()) return
    running = true
    epoch++
    if (pending) await pending
    await refresh()
    scheduleNext()
  }
  async function setFilters({ page = 0, unreadOnly = state.unreadOnly } = {}) {
    revision++
    state.page = page
    state.unreadOnly = unreadOnly
    if (pending) await pending
    await refresh()
  }
  async function read(id) {
    if (state.reading) return
    const ownEpoch = epoch
    const ownIdentity = identity()
    revision++ // An earlier poll must not overwrite the completed PATCH.
    state.reading = id
    state.error = ''
    try {
      const result = await markRead(id)
      if (!running || ownEpoch !== epoch || identity() !== ownIdentity) return
      revision++ // Also discard a poll that began while the PATCH was in progress.
      const item = state.items.find(item => item.id === id)
      if (item && !item.readAt) state.unreadCount = Math.max(0, state.unreadCount - 1)
      state.items = state.items.map(item => item.id === id ? result : item)
      if (pending) await pending
      await refresh()
      return result
    } catch (error) {
      if (running && ownEpoch === epoch && identity() === ownIdentity) state.error = error.message
      return null
    } finally { if (ownEpoch === epoch) state.reading = null }
  }
  return { state, start, stop, refresh, setFilters, read }
}
export const notificationFeed = createNotificationFeed()
