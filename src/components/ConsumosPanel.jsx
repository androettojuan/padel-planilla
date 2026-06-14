import { useState } from 'react'
import { PAGOS_BY_ID } from '../data/defaults'
import { uid, formatMoney } from '../utils/helpers'
import NombreInput from './NombreInput'

export default function ConsumosPanel({ config, planilla, update, sugerencias, onCommitNombre }) {
  const productos = config.productos || []
  // Solo se listan los consumos sin cobrar; al cerrar la cuenta del jugador
  // quedan pagados y salen de esta vista (siguen sumando en los totales del día).
  const consumos = (planilla.consumos || []).filter((c) => !c.pagado)
  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  const [jugador, setJugador] = useState('')

  const totalConsumos = consumos.reduce(
    (s, c) => s + (Number(c.precio) || 0) * (Number(c.cantidad) || 0),
    0,
  )

  const addConsumo = () => {
    const prod = productos.find((p) => p.id === productoId)
    if (!prod) return
    if (!jugador.trim()) return // un consumo siempre va asociado a un jugador
    const nuevo = {
      id: uid(),
      jugador: jugador.trim(),
      productoId: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      cantidad: 1,
      pagado: false,
    }
    update((prev) => ({ ...prev, consumos: [...(prev.consumos || []), nuevo] }))
    setJugador('')
  }

  const updateConsumo = (id, patch) =>
    update((prev) => ({
      ...prev,
      consumos: (prev.consumos || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))

  const removeConsumo = (id) =>
    update((prev) => ({ ...prev, consumos: (prev.consumos || []).filter((c) => c.id !== id) }))

  return (
    <div className="consumos">
      <div className="section-head">
        <h2 className="section-title">Consumos</h2>
        <span className="consumos__total">{formatMoney(totalConsumos)}</span>
      </div>

      <div className="consumos__card">
      <div className="consumos__form">
        <NombreInput
          className="consumos__player"
          placeholder="Jugador"
          value={jugador}
          sugerencias={sugerencias}
          onChange={setJugador}
          onCommit={onCommitNombre}
          onEnter={addConsumo}
        />
        <select
          className="consumos__product"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
        >
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {formatMoney(p.precio)}
            </option>
          ))}
        </select>
        <button className="btn btn--primary" onClick={addConsumo} disabled={!jugador.trim()}>
          Agregar
        </button>
      </div>

      {consumos.length === 0 ? (
        <p className="consumos__empty muted">Todavía no hay consumos cargados.</p>
      ) : (
        <ul className="consumos__list">
          {consumos.map((c) => {
            const medio = c.pagado ? PAGOS_BY_ID[c.pago] : null
            return (
            <li className={`consumo ${c.pagado ? 'consumo--pagado' : ''}`} key={c.id}>
              <div className="consumo__info">
                <span className="consumo__name">{c.nombre}</span>
                {c.jugador && <span className="consumo__player">{c.jugador}</span>}
              </div>
              <div className="consumo__qty">
                <button
                  className="qty-btn"
                  disabled={c.pagado}
                  onClick={() => updateConsumo(c.id, { cantidad: Math.max(1, (Number(c.cantidad) || 1) - 1) })}
                >
                  −
                </button>
                <span className="qty-value">{c.cantidad}</span>
                <button
                  className="qty-btn"
                  disabled={c.pagado}
                  onClick={() => updateConsumo(c.id, { cantidad: (Number(c.cantidad) || 1) + 1 })}
                >
                  +
                </button>
              </div>
              <span className="consumo__sub">
                {formatMoney((Number(c.precio) || 0) * (Number(c.cantidad) || 0))}
              </span>
              {c.pagado ? (
                <span
                  className="pago pago--sm pago--lock"
                  style={{ '--pago-color': medio?.color }}
                  title={`Pagado · ${medio?.label || ''}`}
                >
                  ✓ {medio?.short || 'OK'}
                </span>
              ) : (
                <button className="player__del" onClick={() => removeConsumo(c.id)} aria-label="Quitar">
                  ×
                </button>
              )}
            </li>
            )
          })}
        </ul>
      )}
      </div>
    </div>
  )
}
