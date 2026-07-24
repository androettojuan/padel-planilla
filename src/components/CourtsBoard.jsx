import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * Mantiene una barra de desplazamiento auxiliar en sincronía con el tablero.
 *
 * Con muchos horarios la tabla es larga y la barra propia del tablero queda al
 * pie: para correrse a la última cancha había que bajar hasta el fondo. Esta
 * segunda barra se pega arriba y desplaza lo mismo, sin moverse de lugar.
 */
function useBarraScroll(activa) {
  const tablero = useRef(null)
  const barra = useRef(null)
  const [ancho, setAncho] = useState({ total: 0, visible: 0 })
  const sincronizando = useRef(false)

  useEffect(() => {
    const el = tablero.current
    if (!activa || !el) {
      setAncho({ total: 0, visible: 0 })
      return
    }
    const medir = () => setAncho({ total: el.scrollWidth, visible: el.clientWidth })
    medir()
    // El ancho cambia al agregar canchas/horarios o al redimensionar la ventana.
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [activa])

  // Cada barra mueve a la otra; la bandera evita que se retroalimenten.
  const sincronizar = useCallback((origen) => {
    const destino = origen === 'barra' ? tablero.current : barra.current
    const fuente = origen === 'barra' ? barra.current : tablero.current
    if (!destino || !fuente || sincronizando.current) return
    sincronizando.current = true
    destino.scrollLeft = fuente.scrollLeft
    requestAnimationFrame(() => {
      sincronizando.current = false
    })
  }, [])

  return { tablero, barra, ancho, sincronizar, visible: ancho.total > ancho.visible + 1 }
}

export default function CourtsBoard({ config, horarios, planilla, update, loading, sugerencias, onCommitNombre }) {
  const { canchas } = config
  const turnos = planilla.turnos || {}
  const isMobile = useIsMobile()
  const scroll = useBarraScroll(!isMobile)

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

  // Cada cancha tiene un ancho mínimo usable: con muchas canchas la planilla se
  // desplaza en horizontal en vez de aplastar los campos hasta hacerlos ilegibles.
  // La columna de horarios necesita entrar entera ("18:00 A 19:30"): si se
  // achicara, su texto se saldría por encima de la primera cancha al desplazar.
  const cols = `minmax(124px, max-content) repeat(${canchas.length}, minmax(264px, 1fr))`

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
        <>
          {/* Los encabezados quedan pegados arriba y llevan la barra de
              desplazamiento: se ve de qué cancha es cada columna y se puede
              correr el tablero sin bajar hasta el pie de la planilla. */}
          <div
            className="courts__heads"
            ref={scroll.barra}
            onScroll={() => scroll.sincronizar('barra')}
          >
            {/* Mismo ancho exacto que el tablero para que las columnas coincidan. */}
            <div
              className="cgrid cgrid--heads"
              style={{ gridTemplateColumns: cols, width: scroll.ancho.total || undefined }}
            >
              <div className="cgrid__corner" />
              {canchas.map((c) => (
                <div className="cgrid__chead" key={c.id}>
                  <span>{c.nombre}</span>
                  <span className="cgrid__chead-sub">{formatMoney(subtotal(c.id))}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="courts__scroll"
            ref={scroll.tablero}
            onScroll={() => scroll.sincronizar('tablero')}
          >
            <div className="cgrid" style={{ gridTemplateColumns: cols }}>
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
        </>
      )}
    </div>
  )
}
