import { Fragment } from 'react'
import { turnoKey, horarioLabel } from '../data/defaults'
import { uid, formatMoney } from '../utils/helpers'
import SlotCell from './SlotCell'

export default function CourtsBoard({ config, planilla, update, loading }) {
  const { canchas, horarios } = config
  const turnos = planilla.turnos || {}

  const mutateSlot = (key, fn) =>
    update((prev) => {
      const lista = prev.turnos[key] || []
      return { ...prev, turnos: { ...prev.turnos, [key]: fn(lista) } }
    })

  const addPlayer = (canchaId, horarioId) =>
    mutateSlot(turnoKey(canchaId, horarioId), (lista) => [
      ...lista,
      { id: uid(), jugador: '', monto: '', pagado: false },
    ])

  const updatePlayer = (canchaId, horarioId, id, patch) =>
    mutateSlot(turnoKey(canchaId, horarioId), (lista) =>
      lista.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    )

  const removePlayer = (canchaId, horarioId, id) =>
    mutateSlot(turnoKey(canchaId, horarioId), (lista) => lista.filter((t) => t.id !== id))

  const subtotal = (canchaId) =>
    horarios.reduce(
      (s, h) =>
        s + (turnos[turnoKey(canchaId, h.id)] || []).reduce((a, t) => a + (Number(t.monto) || 0), 0),
      0,
    )

  const cols = `minmax(86px, max-content) repeat(${canchas.length}, minmax(0, 1fr))`

  return (
    <div className="courts">
      <div className="section-head">
        <h2 className="section-title">Turnos</h2>
        {loading && <span className="muted">cargando…</span>}
      </div>

      <div className="courts__scroll">
        <div className="cgrid" style={{ gridTemplateColumns: cols }}>
          <div className="cgrid__corner" />
          {canchas.map((c) => (
            <div className="cgrid__chead" key={c.id}>
              <span>{c.nombre}</span>
              <span className="cgrid__chead-sub">{formatMoney(subtotal(c.id))}</span>
            </div>
          ))}

          {horarios.map((h) => (
            <Fragment key={h.id}>
              <div className="cgrid__time">{horarioLabel(h)}</div>
              {canchas.map((c) => (
                <SlotCell
                  key={c.id}
                  jugadores={turnos[turnoKey(c.id, h.id)] || []}
                  onAdd={() => addPlayer(c.id, h.id)}
                  onUpdate={(id, patch) => updatePlayer(c.id, h.id, id, patch)}
                  onRemove={(id) => removePlayer(c.id, h.id, id)}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
