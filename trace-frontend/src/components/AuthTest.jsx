/**
 * TEMPORARY — Firebase Auth integration test component.
 * Not the final TRACE UI. Remove or replace before production.
 *
 * Tests:
 *  - Email/Password signup
 *  - Email/Password login
 *  - Google sign-in (popup)
 *  - Logout
 *  - Displays authenticated user info (email, display name, UID)
 *  - Calls FastAPI /api/auth/me to verify backend token validation
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { useState } from 'react'
import { auth, googleProvider } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { fetchMe } from '@/lib/api'

export function AuthTest() {
  const { user, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Backend auth test state
  const [backendResult, setBackendResult] = useState(null)
  const [backendError, setBackendError] = useState(null)
  const [backendBusy, setBackendBusy] = useState(false)

  function clearError() {
    setError(null)
  }

  async function handleTestBackend() {
    setBackendResult(null)
    setBackendError(null)
    setBackendBusy(true)
    try {
      const data = await fetchMe(user)
      setBackendResult(data)
    } catch (err) {
      setBackendError(err.message)
    } finally {
      setBackendBusy(false)
    }
  }

  async function handleSignup() {
    clearError()
    setBusy(true)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogin() {
    clearError()
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    clearError()
    setBusy(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    clearError()
    setBusy(true)
    try {
      await signOut(auth)
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Checking auth state…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-widest text-foreground mb-1">
          TRACE
        </h1>
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Firebase Auth · Temporary Test
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        {user ? (
          /* ── Authenticated state ── */
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
                Signed in as
              </p>
              <div className="space-y-1 text-sm text-foreground break-all">
                {user.displayName && (
                  <p><span className="text-muted-foreground">Name: </span>{user.displayName}</p>
                )}
                <p><span className="text-muted-foreground">Email: </span>{user.email}</p>
                <p><span className="text-muted-foreground">UID: </span>{user.uid}</p>
                <p>
                  <span className="text-muted-foreground">Provider: </span>
                  {user.providerData[0]?.providerId ?? 'unknown'}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                {error}
              </p>
            )}

            {/* ── Backend auth test ── */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleTestBackend}
                disabled={backendBusy}
              >
                {backendBusy ? 'Contacting backend…' : 'Test Backend Authentication'}
              </Button>

              {backendResult && (
                <div className="rounded-md border border-border bg-muted/40 px-4 py-3 space-y-1 text-sm text-foreground break-all">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
                    Backend response
                  </p>
                  {backendResult.uid && (
                    <p><span className="text-muted-foreground">UID: </span>{backendResult.uid}</p>
                  )}
                  {backendResult.email && (
                    <p><span className="text-muted-foreground">Email: </span>{backendResult.email}</p>
                  )}
                  {backendResult.name && (
                    <p><span className="text-muted-foreground">Name: </span>{backendResult.name}</p>
                  )}
                </div>
              )}

              {backendError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                  Backend error: {backendError}
                </p>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              disabled={busy}
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        ) : (
          /* ── Unauthenticated state ── */
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Sign in / Sign up
            </p>

            {/* Email + Password inputs */}
            <div className="space-y-2">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                {error}
              </p>
            )}

            {/* Email/Password actions */}
            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={handleLogin}
                disabled={busy || !email || !password}
              >
                {busy ? '…' : 'Log in'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSignup}
                disabled={busy || !email || !password}
              >
                {busy ? '…' : 'Sign up'}
              </Button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Google sign-in */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Continue with Google'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
