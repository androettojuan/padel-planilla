import { useMemo, useState } from 'react'
import { PAGOS } from '../data/defaults'
import { uid, formatMoney } from '../utils/helpers'
import PagoSelector from './PagoSelector'

export default function ConsumosPanel({ config, planilla, update }) {
  const productos = config.productos || []
  const consumos = planilla.consumos || []
  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  const [jugador, setJugador] = useState('')

  // Jugadores ya anotados en la grilla de turnos, para asociar los consumos.
  const jugadoresCargados = useMemo(() => {
    const set = new Set()
    for (const lista of Object.values(planilla.turnos || {})) {
      for (const t of lista) {
        const n = (t.jugador || '').trim()
        if (n) set.add(n)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [planilla.turnos])

  const totalConsumos = consumos.reduce(
    (s, c) => s + (Number(c.precio) || 0) * (Number(c.cantidad) || 0),
    0,
  )

  const addConsumo = () => {
    const prod = productos.find((p) => p.id === productoId)
    if (!prod) return
    const nuevo = {
      id: uid(),
      jugador: jugador.trim(),
      productoId: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      cantidad: 1,
      pago: PAGOS[0].id,
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
        <input
          className="consumos__player"
          placeholder="Jugador"
          list="jugadores-cargados"
          value={jugador}
          onChange={(e) => setJugador(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addConsumo()}
        />
        <datalist id="jugadores-cargados">
          {jugadoresCargados.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
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
        <button className="btn btn--primary" onClick={addConsumo}>
          Agregar
        </button>
      </div>

      {consumos.length === 0 ? (
        <p className="consumos__empty muted">Todavía no hay consumos cargados.</p>
      ) : (
        <ul className="consumos__list">
          {consumos.map((c) => (
            <li className="consumo" key={c.id}>
              <div className="consumo__info">
                <span className="consumo__name">{c.nombre}</span>
                {c.jugador && <span className="consumo__player">{c.jugador}</span>}
              </div>
              <div className="consumo__qty">
                <button
                  className="qty-btn"
                  onClick={() => updateConsumo(c.id, { cantidad: Math.max(1, (Number(c.cantidad) || 1) - 1) })}
                >
                  −
                </button>
                <span className="qty-value">{c.cantidad}</span>
                <button
                  className="qty-btn"
                  onClick={() => updateConsumo(c.id, { cantidad: (Number(c.cantidad) || 1) + 1 })}
                >
                  +
                </button>
              </div>
              <span className="consumo__sub">
                {formatMoney((Number(c.precio) || 0) * (Number(c.cantidad) || 0))}
              </span>
              <PagoSelector value={c.pago} size="sm" onChange={(pago) => updateConsumo(c.id, { pago })} />
              <button className="player__del" onClick={() => removeConsumo(c.id)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}
