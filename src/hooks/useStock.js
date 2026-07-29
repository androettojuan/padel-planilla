import { useCallback, useEffect, useState } from 'react'
import {
  subscribeStock,
  registrarCompra,
  ajustarStock,
  guardarMinimo,
  moverStock,
} from '../firebase/stock'

/**
 * Stock del club, sincronizado en vivo: { [productoId]: { cantidad, costo, minimo } }.
 *
 * `descontar` recibe { [productoId]: unidades } y mueve el stock (negativo al
 * cargar un consumo, positivo al darlo de baja). Solo toca los productos que ya
 * están bajo control; el resto se vende sin descontar.
 */
export function useStock(clubId) {
  const [stock, setStock] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!clubId) return
    setLoading(true)
    const unsub = subscribeStock(
      clubId,
      (data) => {
        setStock(data)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [clubId])

  const descontar = useCallback(
    (deltas) => {
      const controlados = new Set(Object.keys(stock))
      // No esperamos la escritura: el consumo ya se guardó y la suscripción trae
      // la cantidad nueva. Si falla, queda el error visible pero no bloquea la venta.
      moverStock(clubId, deltas, controlados).catch(setError)
    },
    [clubId, stock],
  )

  const comprar = useCallback((compra) => registrarCompra(clubId, compra), [clubId])
  const ajustar = useCallback((productoId, cantidad) => ajustarStock(clubId, productoId, cantidad), [clubId])
  const setMinimo = useCallback(
    (productoId, minimo) => guardarMinimo(clubId, productoId, minimo),
    [clubId],
  )

  return { stock, loading, error, descontar, comprar, ajustar, setMinimo }
}
