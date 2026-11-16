import { downloadFile, request } from '../services/http.js'
import { requireCompleteSchedule } from './model.js'
export const calculateSimulation = async body => requireCompleteSchedule(await request('/simulations/calculate', { method: 'POST', body }))
export const getSimulation = async id => requireCompleteSchedule(await request(`/simulations/${encodeURIComponent(id)}`))
export const getOfferSchedule = async id => requireCompleteSchedule(await request(`/offers/${encodeURIComponent(id)}/schedule`))
export const generateOfferSchedule = async id => requireCompleteSchedule(await request(`/offers/${encodeURIComponent(id)}/schedule`, { method: 'POST' }))

export const downloadSimulationXlsx = async id =>
  downloadFile(`/simulations/${encodeURIComponent(id)}/export/xlsx`, `cronograma_simulacion_${id}.xlsx`)

export const downloadOfferScheduleXlsx = async offerId =>
  downloadFile(`/offers/${encodeURIComponent(offerId)}/schedule/export/xlsx`, `cronograma_oferta_${offerId}.xlsx`)
