import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'

/**
 * Firebase configuration loaded from Vite environment variables.
 * All values must be set in a local .env file (see .env.example).
 * Never hardcode credentials here.
 */
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase app (singleton — safe to import from multiple modules)
const app = initializeApp(firebaseConfig)

// Firebase Auth instance — Email/Password and Google providers enabled
const auth = getAuth(app)

// Google Auth provider instance
const googleProvider = new GoogleAuthProvider()

export { app, auth, googleProvider }
