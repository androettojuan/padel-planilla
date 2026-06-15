import { Fragment, useEffect, useState } from 'react'
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

// En teléfono cambiamos el layout: en vez de la tabla con una columna por cancha
// (que obliga a hacer scroll horizontal), apilamos las canchas verticalmente.
const MOBILE_QUERY = '(max-width: 640px)'
function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export default function CourtsBoard({ config, horarios, planilla, update, loading, sugerencias, onCommitNombre }) {
  const { canchas } = config
  const turnos = planilla.turnos || {}
  const isMobile = useIsMobile()

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

  // Una celda de turno (compartida por ambos layouts).
  const renderSlot = (c, h) => (
    <SlotCell
      jugadores={turnos[turnoKey(c.id, h.id)] || []}
      onAdd={() => addPlayer(c.id, h.id)}
      onUpdate={(index, patch) => updatePlayer(c.id, h.id, index, patch)}
      onRemove={(index) => removePlayer(c.id, h.id, index)}
      sugerencias={sugerencias}
      onCommitNombre={onCommitNombre}
    />
  )

  const cols = `minmax(86px, max-content) repeat(${canchas.length}, minmax(0, 1fr))`

  return (
    <div className="courts">
      <div className="section-head">
        <h2 className="section-title">Turnos</h2>
        {loading && <span className="muted">cargando…</span>}
      </div>

      {isMobile ? (
        // Móvil: una cancha debajo de la otra, cada horario a todo el ancho.
        <div className="cmob">
          {canchas.map((c) => (
            <section className="cmob__court" key={c.id}>
              <div className="cgrid__chead cmob__chead">
                <span>{c.nombre}</span>
                <span className="cgrid__chead-sub">{formatMoney(subtotal(c.id))}</span>
              </div>
              {horarios.map((h) => (
                <div className="cmob__row" key={h.id}>
                  <div className="cmob__time">{horarioLabel(h)}</div>
                  {renderSlot(c, h)}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        // Escritorio: tabla con horarios alineados y una columna por cancha.
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
                  <Fragment key={c.id}>{renderSlot(c, h)}</Fragment>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
