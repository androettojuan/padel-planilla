import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const db = app ? getFirestore(app) : null
export const auth = app ? getAuth(app) : null

const googleProvider = new GoogleAuthProvider()

// Login con Google. El acceso real lo controla la allowlist + las reglas de
// Firestore; acá solo autenticamos al usuario.
export function signInWithGoogle() {
  if (!auth) return Promise.resolve(null)
  return signInWithPopup(auth, googleProvider)
}

export function signOutUser() {
  if (!auth) return Promise.resolve()
  return signOut(auth)
}

// Notifica el usuario actual (o null) cada vez que cambia el estado de sesión.
export function subscribeAuth(cb) {
  if (!auth) {
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(auth, cb)
}
