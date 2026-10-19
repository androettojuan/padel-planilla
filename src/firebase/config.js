import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

// Con VITE_USE_EMULATOR=1 (`npm run dev:emulator`) la app habla con el emulador
// local en vez de la nube: misma configuración, datos de prueba.
const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Contra el emulador alcanza con el projectId: las claves no se validan.
const emulatorConfig = {
  apiKey: 'demo-key',
  projectId: firebaseConfig.projectId || 'planilla-carest',
  // El popup de login lo sirve el propio emulador, pero el SDK exige el campo.
  authDomain: 'localhost',
}

export const isFirebaseConfigured =
  useEmulator || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const app = isFirebaseConfigured
  ? initializeApp(useEmulator ? emulatorConfig : firebaseConfig)
  : null
export const db = app ? getFirestore(app) : null
export const auth = app ? getAuth(app) : null
export const isEmulator = useEmulator

// Los puertos se pueden cambiar (VITE_EMULATOR_FIRESTORE_PORT / _AUTH_PORT) para
// convivir con otro emulador corriendo en los de siempre, como hacen las capturas.
const firestorePort = Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT) || 8080
const authPort = Number(import.meta.env.VITE_EMULATOR_AUTH_PORT) || 9099

if (useEmulator && db && auth) {
  connectFirestoreEmulator(db, '127.0.0.1', firestorePort)
  connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true })
  // Entrar sin pasar por el popup, para los scripts que manejan el navegador
  // (capturas). El emulador acepta un token de Google sin firmar.
  window.__entrarComo = (email, nombre = '') =>
    signInWithCredential(
      auth,
      GoogleAuthProvider.credential(
        JSON.stringify({ sub: email, email, name: nombre, email_verified: true }),
      ),
    )
}

const googleProvider = new GoogleAuthProvider()

// Login con Google. El acceso real lo controlan la membresía al club y las
// reglas de Firestore; acá solo autenticamos al usuario.
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
