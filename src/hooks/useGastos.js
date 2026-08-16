import { useCallback, useEffect, useState } from 'react'
import {
  subscribeGastosFijos,
  saveGastoFijo as persistGasto,
  deleteGastoFijo as removeGasto,
} from '../firebase/gastos'

/**
 * Mantiene sincronizada la plantilla de gastos fijos del club (qué se paga todos
 * los meses y cuánto suele salir). Los pagos de cada mes no van acá: se cargan
 * por mes en la pantalla, como las compras de stock.
 */
export function useGastos(clubId) {
  const [gastos, setGastos] = useState([])

  useEffect(() => {
    if (!clubId) {
      setGastos([])
      return
    }
    return subscribeGastosFijos(
      clubId,
      (list) => setGastos(list),
      () => {},
    )
  }, [clubId])

  const saveGasto = useCallback(
    (g) => {
      setGastos((prev) =>
        prev.some((p) => p.id === g.id)
          ? prev.map((p) => (p.id === g.id ? { ...p, ...g } : p))
          : [...prev, g],
      )
      return persistGasto(clubId, g)
    },
    [clubId],
  )

  const deleteGasto = useCallback(
    (id) => {
      setGastos((prev) => prev.filter((p) => p.id !== id))
      return removeGasto(clubId, id)
    },
    [clubId],
  )

  return { gastos, saveGasto, deleteGasto }
}
