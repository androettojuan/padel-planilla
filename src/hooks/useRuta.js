import { useCallback, useEffect, useRef, useState } from 'react'

// Secciones de la app. La ruta vive en el hash de la URL (#/stock), así el botón
// atrás del navegador funciona y recargar deja la tablet donde estaba, sin
// necesidad de una librería de ruteo.
export const RUTAS = {
  planilla: { titulo: 'Planilla', icono: '📋' },
  stock: { titulo: 'Stock', icono: '📦' },
  jugadores: { titulo: 'Jugadores', icono: '🎾' },
  finanzas: { titulo: 'Finanzas', icono: '💰' },
  config: { titulo: 'Configuración', icono: '⚙️' },
  // Solo para super admins: no aparece en las pestañas, se entra desde el header.
  clubes: { titulo: 'Clubes', icono: '★', oculta: true },
}

export const RUTA_INICIAL = 'planilla'

// Pestañas visibles, en orden.
export const RUTAS_VISIBLES = Object.entries(RUTAS)
  .filter(([, r]) => !r.oculta)
  .map(([id, r]) => ({ id, ...r }))

const leerHash = () => {
  const id = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0]
  return RUTAS[id] ? id : RUTA_INICIAL
}

export function useRuta() {
  const [ruta, setRuta] = useState(leerHash)
  // Una pantalla con cambios sin guardar puede pedir que se le avise antes de
  // dejarla. Su función recibe el destino y devuelve false para frenar la
  // salida: queda a cargo de preguntar y, si el usuario decide irse, navegar.
  const guardia = useRef(null)
  const rutaActual = useRef(ruta)
  rutaActual.current = ruta

  const bloquearSalida = useCallback((fn) => {
    guardia.current = fn
    return () => {
      if (guardia.current === fn) guardia.current = null
    }
  }, [])

  useEffect(() => {
    const onHash = () => {
      const destino = leerHash()
      if (destino === rutaActual.current) return
      if (guardia.current && !guardia.current(destino)) {
        // Se frena acá: volvemos el hash a donde estábamos sin sumar una entrada
        // al historial (replaceState no dispara hashchange, así que no da vueltas).
        window.history.replaceState(null, '', `#/${rutaActual.current}`)
        return
      }
      setRuta(destino)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Navegar es cambiar el hash; el listener actualiza el estado. Así queda una
  // sola fuente de verdad —incluido el botón atrás, que pasa por el mismo
  // control— y las entradas del historial las maneja el navegador.
  const ir = useCallback((destino) => {
    const id = RUTAS[destino] ? destino : RUTA_INICIAL
    if (leerHash() === id) return
    window.location.hash = `#/${id}`
  }, [])

  return { ruta, ir, bloquearSalida }
}
