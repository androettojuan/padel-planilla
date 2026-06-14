import { useEffect, useRef, useState, useCallback } from 'react'
import { subscribePlanilla, savePlanilla } from '../firebase/planillas'
import { emptyPlanilla } from '../data/defaults'

/**
 * Mantiene la planilla del día en estado local y la persiste en Firestore con
 * debounce. Como el uso es interno (un solo punto de carga), evitamos resolver
 * conflictos: el último guardado gana. La suscripción mantiene sincronizado el
 * estado cuando el documento cambia y no hay ediciones locales pendientes.
 */
export function usePlanilla(dateKey, enabled = true) {
  const [planilla, setPlanilla] = useState(emptyPlanilla())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const dirtyRef = useRef(false)
  const saveTimer = useRef(null)
  const planillaRef = useRef(planilla)
  planillaRef.current = planilla

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    dirtyRef.current = false
    const unsub = subscribePlanilla(
      dateKey,
      (data) => {
        // Solo pisamos el estado local si no hay cambios sin guardar.
        if (!dirtyRef.current) setPlanilla(data)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return () => {
      unsub()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [dateKey, enabled])

  const persist = useCallback(
    (next) => {
      dirtyRef.current = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await savePlanilla(dateKey, next)
          dirtyRef.current = false
        } catch (err) {
          setError(err)
        }
      }, 500)
    },
    [dateKey],
  )

  const update = useCallback(
    (updater) => {
      setPlanilla((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        persist(next)
        return next
      })
    },
    [persist],
  )

  return { planilla, update, loading, error }
}
