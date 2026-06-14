import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import {
  db,
  isFirebaseConfigured,
  subscribeAuth,
  signInWithGoogle,
  signOutUser,
} from '../firebase/config'

/**
 * Maneja la sesión con Google y la autorización por allowlist.
 *
 * Un usuario está autorizado solo si existe el documento allowlist/{email}
 * (que administra el dueño desde la consola). Las reglas de Firestore exigen
 * lo mismo, así que la UI y la seguridad usan el mismo criterio.
 *
 * En modo demo (sin Firebase) no hay login: acceso total local.
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [authorized, setAuthorized] = useState(!isFirebaseConfigured)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsub = subscribeAuth(async (u) => {
      setUser(u)
      if (!u || !u.email) {
        // Sin usuario o sin email (p. ej. una sesión anónima vieja): no autorizado.
        setAuthorized(false)
        setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'allowlist', u.email))
        setAuthorized(snap.exists())
      } catch (err) {
        setError(err)
        setAuthorized(false)
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const signIn = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      // El usuario cerró el popup: no es un error que valga la pena mostrar.
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err)
      }
    }
  }

  return { user, authorized, loading, error, signIn, signOut: signOutUser }
}
