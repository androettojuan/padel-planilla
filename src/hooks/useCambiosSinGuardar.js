import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Avisa antes de dejar una pantalla que tiene cambios sin guardar.
 *
 * La usa Configuración, que es la única sección con botón "Guardar": en el resto
 * lo que se escribe se persiste solo, así que salir nunca pierde nada.
 *
 * Cubre las tres formas de irse: tocar otra pestaña, el botón atrás del
 * navegador (las dos pasan por `bloquearSalida` de useRuta) y cerrar o recargar
 * la pestaña del navegador, que solo permite el cartel propio del browser.
 *
 * Devuelve el destino pendiente —con el que se muestra el cartel— y las dos
 * salidas: `salir()` se va descartando, `quedarse()` cancela.
 */
export function useCambiosSinGuardar({ hayCambios, bloquearSalida, ir }) {
  const [pendiente, setPendiente] = useState(null)
  // Cuando el usuario ya decidió irse, la próxima navegación pasa de largo: si
  // no, el mismo guardia volvería a frenarla.
  const dejarPasar = useRef(false)

  useEffect(() => {
    if (!hayCambios) return
    return bloquearSalida((destino) => {
      if (dejarPasar.current) return true
      setPendiente(destino)
      return false
    })
  }, [hayCambios, bloquearSalida])

  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  const salir = useCallback(
    (destino = pendiente) => {
      dejarPasar.current = true
      setPendiente(null)
      if (destino) ir(destino)
    },
    [pendiente, ir],
  )

  return { pendiente, salir, quedarse: () => setPendiente(null) }
}
