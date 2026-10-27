import { request } from '../services/http.js'
import { propertyQuery } from './model.js'

export const listProperties = (filters) => request(`/properties?${propertyQuery(filters)}`)
export const createProperty = (property) => request('/properties', { method: 'POST', body: property })
export const deleteProperty = (id) => request(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE' })
