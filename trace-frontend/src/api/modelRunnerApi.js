/**
 * modelRunnerApi.js
 * All HTTP calls for the /model-runner feature.
 * Uses apiFetch for auth + base-URL injection.
 * Multipart file uploads bypass apiFetch (no Content-Type override needed).
 */
import { API_BASE } from '@/lib/api'
import { auth } from '@/lib/firebase'

// ── Auth header helper ─────────────────────────────────────────────────────
async function _authHeaders() {
  const headers = {}
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    } catch { /* continue unauthenticated */ }
  }
  return headers
}

// ── Upload (preview only, does NOT start pipeline) ─────────────────────────
export async function uploadDataset(file) {
  const form = new FormData()
  form.append('file', file)
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/upload`, {
    method: 'POST', body: form, headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `Upload failed (${res.status})`)
  }
  return res.json()
}

// ── Start analysis pipeline (returns {analysis_id} immediately) ────────────
export async function startAnalysis({ file, plantName, referencePeriod, tariff, settlementFactor }) {
  const form = new FormData()
  form.append('file', file)
  form.append('plant_name', plantName ?? 'Uploaded Plant')
  form.append('reference_period', referencePeriod ?? 'auto')
  if (tariff != null) form.append('tariff', String(tariff))
  form.append('settlement_factor', String(settlementFactor ?? 1.0))

  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/analyze`, {
    method: 'POST', body: form, headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `Analysis start failed (${res.status})`)
  }
  return res.json()  // { analysis_id, status, message }
}

// ── Poll pipeline status ───────────────────────────────────────────────────
export async function fetchStatus(analysisId) {
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/status/${analysisId}`, { headers })
  if (!res.ok) throw new Error(`Status fetch failed (${res.status})`)
  return res.json()
}

// ── Fetch full results (only valid after status=completed) ─────────────────
export async function fetchResults(analysisId) {
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/results/${analysisId}`, { headers })
  if (res.status === 202) return null   // still running
  if (!res.ok) throw new Error(`Results fetch failed (${res.status})`)
  return res.json()
}

// ── Fetch event log (supports incremental polling with since=N) ────────────
export async function fetchEvents(analysisId, sinceIndex = 0) {
  const headers = await _authHeaders()
  const res = await fetch(
    `${API_BASE}/api/model-runner/events/${analysisId}?since=${sinceIndex}`,
    { headers },
  )
  if (!res.ok) throw new Error(`Events fetch failed (${res.status})`)
  return res.json()  // { events: [...], total }
}

// ── Fetch analysis history ─────────────────────────────────────────────────
export async function fetchHistory(limit = 20) {
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/history?limit=${limit}`, { headers })
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`)
  return res.json()  // { runs: [...], total }
}

// ── Cancel / stop a running analysis ──────────────────────────────────────
export async function cancelAnalysis(analysisId) {
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/cancel/${analysisId}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
  // 200 = cancelled, 404 = not found / already done — both are acceptable
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `Cancel failed (${res.status})`)
  }
  return res.json().catch(() => ({ status: 'cancelled' }))
}

// ── Re-run analysis with the same config (returns new {analysis_id}) ───────
export async function rerunAnalysis(analysisId) {
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/model-runner/rerun/${analysisId}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `Re-run failed (${res.status})`)
  }
  return res.json()  // { analysis_id, status, message }
}
