/**
 * demoMode.js
 * ─────────────────────────────────────────────────────────────────────────
 * Module-level flag for demo mode. This intentionally lives outside React
 * state so API functions (which are plain async functions, not hooks) can
 * read it synchronously without needing context or props threading.
 *
 * Usage:
 *   import { setDemoMode, isDemoMode } from '@/lib/demoMode'
 *
 *   // In AuthContext:
 *   setDemoMode(true)   // called by signInAsDemo()
 *   setDemoMode(false)  // called by signOut()
 *
 *   // In any API file:
 *   if (isDemoMode()) return staticFallback
 */

let _isDemoMode = false

/** Activate or deactivate demo mode. Called by AuthContext. */
export function setDemoMode(value) {
  _isDemoMode = Boolean(value)
}

/** Returns true when the user entered via the demo button (no real auth). */
export function isDemoMode() {
  return _isDemoMode
}
