import { useCallback, useEffect, useState } from 'react'
import {
  isFirebaseConfigured,
  subscribeAuth,
  signInWithGoogle,
  signOutUser,
} from '../firebase/config'
import { isSuperAdmin as fetchSuperAdmin, loadClubsDelUsuario, DEMO_CLUB } from '../firebase/clubs'

const LS_CLUB_ACTIVO = 'clubActivo'

/**
 * Sesión de la app: quién entró, a qué clubes pertenece y en cuál está parado.
 *
 * Un usuario puede usar la planilla de un club solo si su email figura en
 * clubs/{clubId}/miembros (las reglas de Firestore exigen lo mismo, así que la
 * UI y la seguridad usan el mismo criterio). Aparte, si su email está en
 * `superAdmins` puede crear clubes y administrar sus usuarios.
 *
 * En modo demo (sin Firebase) no hay login: un único club local y acceso total.
 */
export function useSesion() {
  const [user, setUser] = useState(null)
  const [superAdmin, setSuperAdmin] = useState(!isFirebaseConfigured)
  const [clubs, setClubs] = useState(isFirebaseConfigured ? [] : [DEMO_CLUB])
  const [clubId, setClubId] = useState(isFirebaseConfigured ? null : DEMO_CLUB.id)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [error, setError] = useState(null)

  // Elige el club activo: el último usado si sigue disponible, si no el primero.
  const elegirClub = useCallback((lista) => {
    const guardado = localStorage.getItem(LS_CLUB_ACTIVO)
    const siguiente = lista.find((c) => c.id === guardado)?.id || lista[0]?.id || null
    if (siguiente) localStorage.setItem(LS_CLUB_ACTIVO, siguiente)
    setClubId(siguiente)
    return siguiente
  }, [])

  const cargarClubs = useCallback(
    async (email) => {
      const lista = await loadClubsDelUsuario(email)
      setClubs(lista)
      elegirClub(lista)
      return lista
    },
    [elegirClub],
  )

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsub = subscribeAuth(async (u) => {
      setUser(u)
      if (!u || !u.email) {
        setSuperAdmin(false)
        setClubs([])
        setClubId(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const [esSuper] = await Promise.all([fetchSuperAdmin(u.email), cargarClubs(u.email)])
        setSuperAdmin(esSuper)
      } catch (err) {
        setError(err)
        setClubs([])
        setClubId(null)
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [cargarClubs])

  const cambiarClub = useCallback((id) => {
    localStorage.setItem(LS_CLUB_ACTIVO, id)
    setClubId(id)
  }, [])

  // Se llama después de crear un club o de sumarse a uno desde el panel.
  const recargarClubs = useCallback(async () => {
    if (!isFirebaseConfigured || !user?.email) return
    try {
      await cargarClubs(user.email)
    } catch (err) {
      setError(err)
    }
  }, [cargarClubs, user])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      // El usuario cerró el popup: no es un error que valga la pena mostrar.
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request'
      ) {
        setError(err)
      }
    }
  }, [])

  const club = clubs.find((c) => c.id === clubId) || null

  return {
    user,
    superAdmin,
    clubs,
    club,
    clubId,
    // Puede trabajar quien pertenece a algún club; el super admin sin clubes
    // igual entra, pero solo al panel de administración.
    autorizado: Boolean(clubId) || superAdmin,
    loading,
    error,
    cambiarClub,
    recargarClubs,
    setClubLocal: (cambios) =>
      setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, ...cambios } : c))),
    signIn,
    signOut: signOutUser,
  }
}
