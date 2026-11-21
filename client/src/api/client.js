import axios from 'axios'
import { API_BASE_URL } from '../config'

const TOKEN_KEY = 'auth.token'

export const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export const setToken = (token) => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token)
        else localStorage.removeItem(TOKEN_KEY)
    } catch { /* private mode: token lasts for this page load only */ }
}

// Absolute URL for paths the API returns (e.g. "/api/books/:id/cover?v=...")
export const apiUrl = (path) => (path && path.startsWith('/') ? `${API_BASE_URL}${path}` : path || '')

export const api = axios.create({ baseURL: `${API_BASE_URL}/api` })

api.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // A stored token that the server rejects is stale: forget it and tell the app
        if (error.response?.status === 401 && getToken() && !error.config?.url?.includes('/auth/login')) {
            setToken('')
            window.dispatchEvent(new Event('auth:expired'))
        }
        return Promise.reject(error)
    }
)

// A readable message for any API error
export const errorMessage = (error, fallback = 'Something went wrong. Try again.') =>
    error?.response?.data?.message || (error?.message === 'Network Error' ? 'Can’t reach the server. It may be starting up; try again in a minute.' : fallback)
