import { request } from '../services/http.js'

export const login = (credentials) => request('/auth/login', { method: 'POST', body: credentials, authenticated: false })
export const register = (account) => request('/auth/register', { method: 'POST', body: account, authenticated: false })
export const getProfile = () => request('/users/me')
export const updateProfile = (profile) => request('/users/me', { method: 'PUT', body: profile })

export const getTwoFactorStatus = () => request('/users/me/two-factor')
export const setupTwoFactor = (password) => request('/users/me/two-factor/setup', { method: 'POST', body: { password } })
export const confirmTwoFactor = (otp) => request('/users/me/two-factor/confirm', { method: 'POST', body: { otp } })
export const disableTwoFactor = (password, otp) => request('/users/me/two-factor/disable', { method: 'POST', body: { password, otp } })
