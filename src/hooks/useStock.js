import { useCallback, useEffect, useState } from 'react'
import {
  subscribeStock,
  registrarCompra,
  editarCompra,
  deshacerCompra,
  ajustarStock,
  guardarMinimo,
  moverStock,
} from '../firebase/stock'

/**
 * Stock del club, sincronizado en vivo: { [productoId]: { cantidad, costo, minimo } }.
 *
 * `descontar` recibe { [productoId]: unidades } y mueve el stock (negativo al
 * cargar un consumo, positivo al darlo de baja). Los productos que no están bajo
 * control se venden sin descontar; eso lo resuelve `moverStock` mirando la base,
 * así este hook no depende del stock que tenga cargado en el momento y su
 * callback no cambia de identidad en cada venta.
 */
export function useStock(clubId) {
  const [stock, setStock] = useState({})

  useEffect(() => {
    if (!clubId) return
    return subscribeStock(clubId, setStock, (err) => console.error('Stock:', err))
  }, [clubId])

  const descontar = useCallback(
    (deltas) => {
      // No esperamos la escritura: el consumo ya se guardó y la suscripción trae
      // la cantidad nueva. Si falla, queda en la consola pero no traba la venta.
      moverStock(clubId, deltas).catch((err) => console.error('Stock:', err))
    },
    [clubId],
  )

  const comprar = useCallback((compra) => registrarCompra(clubId, compra), [clubId])
  const editar = useCallback((compra, cambios) => editarCompra(clubId, compra, cambios), [clubId])
  const deshacer = useCallback((compra) => deshacerCompra(clubId, compra), [clubId])
  const ajustar = useCallback(
    (productoId, cantidad) => ajustarStock(clubId, productoId, cantidad),
    [clubId],
  )
  const setMinimo = useCallback(
    (productoId, minimo) => guardarMinimo(clubId, productoId, minimo),
    [clubId],
  )

  return { stock, descontar, comprar, editar, deshacer, ajustar, setMinimo }
}
