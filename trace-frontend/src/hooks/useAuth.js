import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'

/**
 * Subscribes to Firebase Auth state changes.
 * Returns the current user (or null) and a loading flag.
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    // Clean up the listener when the component unmounts
    return unsubscribe
  }, [])

  return { user, loading }
}
