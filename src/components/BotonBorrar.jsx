import { useState } from 'react'

/**
 * Botón de borrado con confirmación en el lugar: el "×" se convierte en ✓/✕ y
 * recién al tocar ✓ se borra. Mismo patrón que la confirmación de los turnos,
 * para que borrar nunca sea un solo clic sobre algo cargado.
 *
 * Con `confirmar={false}` borra directo: sirve para las filas vacías, donde
 * preguntar sería solo un clic de más.
 */
export default function BotonBorrar({
  onConfirm,
  confirmar = true,
  label = 'Quitar',
  title = 'Quitar',
}) {
  const [abierto, setAbierto] = useState(false)

  if (abierto) {
    return (
      <div className="confirm-inline">
        <button
          className="confirm-inline__yes"
          onClick={() => {
            setAbierto(false)
            onConfirm()
          }}
          aria-label="Confirmar"
          title="Borrar"
        >
          ✓
        </button>
        <button
          className="confirm-inline__no"
          onClick={() => setAbierto(false)}
          aria-label="Cancelar"
          title="Cancelar"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <button
      className="player__del"
      onClick={() => (confirmar ? setAbierto(true) : onConfirm())}
      aria-label={label}
      title={title}
    >
      ×
    </button>
  )
}
