import { useEffect } from 'react'

/**
 * Solapa pegada al borde derecho que abre el cajón. Queda siempre a la vista
 * sobre la planilla, así se entiende que ahí hay un panel para desplegar.
 */
export function SolapaPaneles({ onOpen, pendiente }) {
  return (
    <button className="paneles-tab" onClick={onOpen} title="Cuentas y consumos">
      <span className="paneles-tab__flecha">‹</span>
      <span className="paneles-tab__texto">Cuentas y consumos</span>
      {pendiente > 0 && <span className="paneles-tab__dot" aria-label="Hay cuentas pendientes" />}
    </button>
  )
}

/**
 * Cajón lateral con Consumos y Cuentas, uno debajo del otro igual que en la
 * columna del costado. Cuando el club tiene muchas canchas la planilla necesita
 * todo el ancho, así que estos paneles se abren acá por encima del tablero.
 */
export default function PanelesDrawer({ onClose, paneles }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-label="Cuentas y consumos"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__head">
          <button className="btn btn--ghost" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="drawer__body">
          {paneles.consumos}
          {paneles.cuentas}
        </div>
      </aside>
    </div>
  )
}
