import { request } from '../services/http.js'

export const login = (credentials) => request('/auth/login', { method: 'POST', body: credentials, authenticated: false })
export const register = (account) => request('/auth/register', { method: 'POST', body: account, authenticated: false })
export const getProfile = () => request('/users/me')
export const updateProfile = (profile) => request('/users/me', { method: 'PUT', body: profile })
