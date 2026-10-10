/**
 * Base API client — all requests go to the FastAPI backend.
 * Auth token is attached automatically when a Firebase user is signed in.
 *
 * API base URL resolution:
 *   - Development : set VITE_API_BASE_URL in trace-frontend/.env, or falls back to localhost:8000
 *   - Production  : set VITE_API_BASE_URL in your hosting provider's environment variables
 *                   (e.g. https://your-backend.onrender.com)
 */
import { auth } from './firebase'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch {
      // Continue unauthenticated if token retrieval fails
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

export { apiFetch, API_BASE }
