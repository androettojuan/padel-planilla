import { useCallback, useEffect, useState } from 'react'

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

  useEffect(() => {
    const onHash = () => setRuta(leerHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Navegar es cambiar el hash; el listener actualiza el estado. Así queda una
  // sola fuente de verdad y las entradas del historial las maneja el navegador.
  const ir = useCallback((destino) => {
    const id = RUTAS[destino] ? destino : RUTA_INICIAL
    if (leerHash() === id) return
    window.location.hash = `#/${id}`
  }, [])

  return { ruta, ir }
}
