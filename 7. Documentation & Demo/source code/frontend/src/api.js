import axios from 'axios'
import { auth, isFirebaseConfigured } from './firebase.js'

// In dev, "/api" is proxied to the Flask backend on :5000 by Vite.
// In production there is no proxy, so VITE_API_BASE_URL points at the
// deployed backend (e.g. https://wasteguide-api.onrender.com).
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api'

// Render's free tier sleeps after inactivity; the first request can take
// ~30s to cold-start, so allow a generous timeout.
const client = axios.create({ baseURL: API_BASE, timeout: 60000 })

// Attach the caller's Firebase ID token to every request. The backend verifies
// the signature and derives the user id from it, so we never send a user_id.
// getIdToken() refreshes automatically when the token is close to expiring.
client.interceptors.request.use(async (config) => {
  if (isFirebaseConfigured && auth?.currentUser) {
    const token = await auth.currentUser.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export async function classifyItem(item) {
  const { data } = await client.post('/classify', { item })
  return data
}

export async function fetchHistory() {
  const { data } = await client.get('/history')
  return data.history
}

export async function clearHistory() {
  const { data } = await client.delete('/history')
  return data
}

export async function fetchCenters(type = 'all') {
  const { data } = await client.get('/centers', { params: { type } })
  return data.centers
}

export async function fetchAnalytics() {
  const { data } = await client.get('/analytics')
  return data
}

export async function fetchHealth() {
  const { data } = await client.get('/health')
  return data
}
