import { useCallback, useEffect, useRef, useState } from 'react'
import {
  subscribeJugadores,
  saveJugador as persistJugador,
  deleteJugador as removeJugador,
} from '../firebase/jugadores'
import { uid, normalizeNombre } from '../utils/helpers'

/**
 * Mantiene el directorio de jugadores sincronizado y expone helpers para
 * editarlo. `upsertNombre` implementa el alta automática (modo híbrido): cuando
 * se confirma un nombre que todavía no está en el directorio, lo agrega solo.
 */
export function useJugadores(enabled = true) {
  const [jugadores, setJugadores] = useState([])
  const jugadoresRef = useRef(jugadores)
  jugadoresRef.current = jugadores

  useEffect(() => {
    if (!enabled) return
    const unsub = subscribeJugadores(
      (list) => setJugadores(list),
      () => {},
    )
    return unsub
  }, [enabled])

  const saveJugador = useCallback((j) => {
    setJugadores((prev) =>
      prev.some((p) => p.id === j.id)
        ? prev.map((p) => (p.id === j.id ? { ...p, ...j } : p))
        : [...prev, j],
    )
    return persistJugador(j)
  }, [])

  const deleteJugador = useCallback((id) => {
    setJugadores((prev) => prev.filter((p) => p.id !== id))
    return removeJugador(id)
  }, [])

  // Alta automática al confirmar un nombre nuevo (case-insensitive).
  const upsertNombre = useCallback(
    (nombre) => {
      const n = (nombre || '').trim()
      if (!n) return
      const clave = normalizeNombre(n)
      if (jugadoresRef.current.some((p) => normalizeNombre(p.nombre) === clave)) return
      saveJugador({ id: uid(), nombre: n, activo: true, creado: Date.now() })
    },
    [saveJugador],
  )

  return { jugadores, saveJugador, deleteJugador, upsertNombre }
}
