/**
 * aiApi.js
 * ─────────────────────────────────────────────────────────────────────────
 * All API calls for the TRACE AI Investigator (Grok-powered chatbot).
 *
 * Endpoints used:
 *   GET  /api/ai/questions       → suggested questions list
 *   POST /api/ai/chat/stream     → streaming SSE chat (primary path)
 *   POST /api/ai/chat            → non-streaming fallback
 *   POST /api/ai/investigate     → legacy single-question (kept for compat)
 *
 * Message shape (matches backend ChatMessage schema):
 *   { role: 'user' | 'assistant', content: string }
 */

import { API_BASE } from '@/lib/api'
import { auth } from '@/lib/firebase'
import { isDemoMode } from '@/lib/demoMode'
import aiData from '@/data/ai-investigator.json'

// ── Auth header helper ─────────────────────────────────────────────────────
async function _authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    } catch { /* continue unauthenticated */ }
  }
  return headers
}

// ── Suggested questions ────────────────────────────────────────────────────
export async function fetchSuggestedQuestions() {
  if (isDemoMode()) return aiData.suggestedQuestions
  try {
    const headers = await _authHeaders()
    const res = await fetch(`${API_BASE}/api/ai/questions`, { headers })
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return data.suggestedQuestions ?? aiData.suggestedQuestions
  } catch {
    return aiData.suggestedQuestions
  }
}

// ── Streaming chat ─────────────────────────────────────────────────────────
/**
 * Send a conversation to Grok via SSE streaming.
 *
 * @param {Array<{role: string, content: string}>} messages  Full conversation history
 * @param {(chunk: string) => void}               onChunk    Called for each text chunk
 * @param {() => void}                            onDone     Called when stream finishes
 * @param {(err: Error) => void}                  onError    Called on failure
 * @returns {AbortController}  Call .abort() to cancel mid-stream
 */
export function streamChat(messages, onChunk, onDone, onError) {
  const controller = new AbortController()

  // In demo mode return a static reply without touching the network
  if (isDemoMode()) {
    const demoReply =
      'This is a demo session. The AI Investigator is available with a live backend. ' +
      'Sign up or log in to run live AI analysis on your own plant data.'
    let i = 0
    const words = demoReply.split(' ')
    const interval = setInterval(() => {
      if (controller.signal.aborted) { clearInterval(interval); return }
      if (i < words.length) {
        onChunk((i === 0 ? '' : ' ') + words[i])
        i++
      } else {
        clearInterval(interval)
        onDone()
      }
    }, 30)
    return controller
  }

  ; (async () => {
      try {
        const headers = await _authHeaders()
        const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.detail ?? `HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''   // keep incomplete last line

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            // Extract payload after 'data:' prefix without trimming inner spaces
            let payload = line.slice(line.indexOf('data:') + 5)
            if (payload.startsWith(' ')) payload = payload.slice(1)
            if (payload.endsWith('\r')) payload = payload.slice(0, -1)

            if (payload === '[DONE]') {
              onDone()
              return
            }
            if (payload.startsWith('[ERROR]')) {
              throw new Error(payload.slice(7).trim())
            }
            // Unescape newlines the backend encoded as \n
            onChunk(payload.replace(/\\n/g, '\n'))
          }
        }
        onDone()
      } catch (err) {
        if (err.name === 'AbortError') return   // user cancelled — not an error
        onError(err)
      }
    })()

  return controller
}

// ── Non-streaming fallback ─────────────────────────────────────────────────
/**
 * Send full conversation; returns complete reply string.
 * Used when streaming is not available or as a fallback.
 */
export async function sendChat(messages) {
  const headers = await _authHeaders()
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.reply ?? ''
}

// ── Legacy single-question (kept for backward compat) ─────────────────────
export async function investigate(question) {
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 150))
    const keyMap = {
      'Why did we miss our generation target?': 'why-did-we-miss',
      'What was the largest controllable loss this period?': 'largest-controllable-loss',
      'Which performance problem is recurring?': 'recurring-problem',
      'How much generation is realistically recoverable?': 'what-is-recoverable',
      'Is the revenue gap driven by generation or commercial terms?': 'revenue-gap-source',
      'What evidence supports the equipment attribution?': 'evidence-conclusion',
    }
    const key = keyMap[question]
    if (key && aiData.responses?.[key]) return aiData.responses[key]
    return {
      question,
      summary: 'Static demo response. Sign up to run live AI analysis on your plant data.',
      primaryCauses: [],
      evidenceIds: [],
      confidence: null,
      recommendedActions: ['Sign up for a full account to enable the live AI Investigator.'],
      caveat: 'Demo mode — static data only.',
    }
  }
  try {
    const headers = await _authHeaders()
    const res = await fetch(`${API_BASE}/api/ai/investigate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  } catch {
    // Static fallback
    await new Promise((r) => setTimeout(r, 300))
    const keyMap = {
      'Why did we miss our generation target?': 'why-did-we-miss',
      'What was the largest controllable loss this period?': 'largest-controllable-loss',
      'Which performance problem is recurring?': 'recurring-problem',
      'How much generation is realistically recoverable?': 'what-is-recoverable',
      'Is the revenue gap driven by generation or commercial terms?': 'revenue-gap-source',
      'What evidence supports the equipment attribution?': 'evidence-conclusion',
    }
    const key = keyMap[question]
    if (key && aiData.responses?.[key]) return aiData.responses[key]
    return {
      question,
      summary: 'The AI Investigator is currently unavailable. Please check the backend configuration.',
      primaryCauses: [],
      evidenceIds: [],
      confidence: null,
      recommendedActions: ['Ensure GROK_API_KEY is set in trace-backend/.env and the server is running.'],
      caveat: 'Offline fallback — no live data available.',
    }
  }
}
