import { Fragment } from 'react'
import { turnoKey, horarioLabel } from '../data/defaults'
import { uid, formatMoney } from '../utils/helpers'
import SlotCell, { MIN_JUGADORES } from './SlotCell'

const freshPlayer = () => ({ id: uid(), jugador: '', monto: '', pagado: false })

// Asegura que la lista tenga al menos n jugadores, rellenando con vacíos.
const ensureLen = (lista, n) => {
  if (lista.length >= n) return lista
  const out = lista.slice()
  while (out.length < n) out.push(freshPlayer())
  return out
}

export default function CourtsBoard({ config, horarios, planilla, update, loading }) {
  const { canchas } = config
  const turnos = planilla.turnos || {}

  const mutateSlot = (key, fn) =>
    update((prev) => {
      const lista = prev.turnos[key] || []
      return { ...prev, turnos: { ...prev.turnos, [key]: fn(lista) } }
    })

  // El "+ Jugador" agrega uno extra por encima de los 4 fijos.
  const addPlayer = (canchaId, horarioId) =>
    mutateSlot(turnoKey(canchaId, horarioId), (lista) => [
      ...ensureLen(lista, MIN_JUGADORES),
      freshPlayer(),
    ])

  // Update por índice: al escribir en una fila fantasma se materializan los 4.
  const updatePlayer = (canchaId, horarioId, index, patch) =>
    mutateSlot(turnoKey(canchaId, horarioId), (lista) =>
      ensureLen(lista, Math.max(MIN_JUGADORES, index + 1)).map((t, i) =>
        i === index ? { ...t, ...patch } : t,
      ),
    )

  const removePlayer = (canchaId, horarioId, index) =>
    mutateSlot(turnoKey(canchaId, horarioId), (lista) => lista.filter((_, i) => i !== index))

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
                  onUpdate={(index, patch) => updatePlayer(c.id, h.id, index, patch)}
                  onRemove={(index) => removePlayer(c.id, h.id, index)}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
