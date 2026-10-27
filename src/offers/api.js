import { request } from '../services/http.js'
export const listOffers = ({ page = 0, size = 20 } = {}) => request(`/offers?${new URLSearchParams({ page, size })}`)
export const getOffer = (id) => request(`/offers/${encodeURIComponent(id)}`)
export const listNotifications = ({ page = 0, size = 20, unreadOnly = false } = {}) => request(`/notifications?${new URLSearchParams({ page, size, unreadOnly })}`)
export const markNotificationRead = (id) => request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
