import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

const AuthContext = createContext(null)

// Synthetic demo user — no Firebase account needed
const DEMO_USER = {
  uid: 'demo-evaluator',
  email: 'evaluator@trace-demo.com',
  displayName: 'Evaluator',
  isAnonymous: false,
  _isDemo: true,
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Only update from Firebase if we're not already in demo mode
      setUser((prev) => {
        if (prev?._isDemo) return prev
        return firebaseUser
      })
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    return signInWithPopup(auth, googleProvider)
  }

  const signOut = async () => {
    if (isDemo) {
      // Clear demo session without touching Firebase
      setUser(null)
      setIsDemo(false)
      return
    }
    return firebaseSignOut(auth)
  }

  /** Bypasses Firebase — sets a synthetic demo user directly in state */
  const signInAsDemo = () => {
    setUser(DEMO_USER)
    setIsDemo(true)
    setLoading(false)
  }

  const value = {
    user,
    loading,
    isDemo,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    signInAsDemo,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
