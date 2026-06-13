import { PAGOS, PAGOS_BY_ID } from '../data/defaults'

// Chip que cicla entre los tipos de pago al hacer click.
export default function PagoSelector({ value, onChange, size = 'md' }) {
  const pago = PAGOS_BY_ID[value] || PAGOS[0]

  const next = () => {
    const idx = PAGOS.findIndex((p) => p.id === pago.id)
    onChange(PAGOS[(idx + 1) % PAGOS.length].id)
  }

  return (
    <button
      type="button"
      className={`pago pago--${size}`}
      style={{ '--pago-color': pago.color }}
      onClick={next}
      title={`${pago.label} (click para cambiar)`}
    >
      {size === 'sm' ? pago.short : pago.label}
    </button>
  )
}
