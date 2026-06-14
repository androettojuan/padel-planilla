import { useState } from 'react'
import { uid, normalizeTime, normalizeNombre } from '../utils/helpers'

// Días de la semana en orden de visualización (id = Date.getDay(): 0=domingo).
const DOW = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
]

export default function ConfigModal({
  config,
  onSave,
  onClose,
  jugadores = [],
  onSaveJugador,
  onDeleteJugador,
}) {
  const [draft, setDraft] = useState(() => structuredClone(config))
  const [saving, setSaving] = useState(false)
  // Pestaña de horarios activa: null = "Por defecto", o un día de la semana (0-6).
  const [dow, setDow] = useState(null)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // ---- Canchas ----
  const addCancha = () =>
    set({ canchas: [...draft.canchas, { id: uid(), nombre: `Cancha ${draft.canchas.length + 1}` }] })
  const updateCancha = (id, nombre) =>
    set({ canchas: draft.canchas.map((c) => (c.id === id ? { ...c, nombre } : c)) })
  const removeCancha = (id) => set({ canchas: draft.canchas.filter((c) => c.id !== id) })

  // ---- Horarios (con override opcional por día de la semana) ----
  const byDow = draft.horariosByDow || {}
  const hasOverride = dow !== null && Array.isArray(byDow[dow])
  // Lista que se está editando: el override del día, o el horario por defecto.
  const horarios = dow === null || !hasOverride ? draft.horarios : byDow[dow]
  // Solo es editable la pestaña "Por defecto" o un día que ya tiene override.
  const editable = dow === null || hasOverride

  const setHorarios = (list) => {
    if (dow === null) {
      set({ horarios: list })
    } else {
      set({ horariosByDow: { ...byDow, [dow]: list } })
    }
  }
  const personalizarDow = () =>
    set({ horariosByDow: { ...byDow, [dow]: structuredClone(draft.horarios) } })
  const usarDefaultDow = () => {
    const next = { ...byDow }
    delete next[dow]
    set({ horariosByDow: next })
  }

  const addHorario = () => {
    const last = horarios[horarios.length - 1]
    setHorarios([...horarios, { id: uid(), desde: last?.hasta || '', hasta: '' }])
  }
  const updateHorario = (id, patch) =>
    setHorarios(horarios.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  const removeHorario = (id) => setHorarios(horarios.filter((h) => h.id !== id))
  const moveHorario = (idx, dir) => {
    const arr = [...horarios]
    const j = idx + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    setHorarios(arr)
  }
  const sortHorarios = () =>
    setHorarios([...horarios].sort((a, b) => (a.desde || '').localeCompare(b.desde || '')))

  // ---- Productos ----
  const addProducto = () =>
    set({ productos: [...(draft.productos || []), { id: uid(), nombre: '', precio: 0 }] })
  const updateProducto = (id, patch) =>
    set({ productos: draft.productos.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const removeProducto = (id) => set({ productos: draft.productos.filter((p) => p.id !== id) })

  const handleSave = async () => {
    setSaving(true)
    const normList = (list) =>
      (list || []).map((h) => ({ ...h, desde: normalizeTime(h.desde), hasta: normalizeTime(h.hasta) }))
    const cleanByDow = {}
    for (const [k, v] of Object.entries(draft.horariosByDow || {})) cleanByDow[k] = normList(v)
    const clean = {
      ...draft,
      horarios: normList(draft.horarios),
      horariosByDow: cleanByDow,
      productos: (draft.productos || []).map((p) => ({ ...p, precio: Number(p.precio) || 0 })),
    }
    try {
      await onSave(clean)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Configuración</h2>
          <button className="player__del" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal__body">
          {/* Club */}
          <section className="cfg-section">
            <h3 className="cfg-section__title">Club</h3>
            <div className="cfg-row">
              <input
                className="cfg-input"
                placeholder="Nombre del club"
                value={draft.club?.nombre || ''}
                onChange={(e) => set({ club: { ...draft.club, nombre: e.target.value } })}
              />
              <input
                className="cfg-input"
                placeholder="Ubicación"
                value={draft.club?.ubicacion || ''}
                onChange={(e) => set({ club: { ...draft.club, ubicacion: e.target.value } })}
              />
            </div>
          </section>

          {/* Canchas */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Canchas</h3>
              <button className="btn btn--add" onClick={addCancha}>
                + Cancha
              </button>
            </div>
            {draft.canchas.map((c) => (
              <div className="cfg-row" key={c.id}>
                <input
                  className="cfg-input"
                  value={c.nombre}
                  placeholder="Nombre de la cancha"
                  onChange={(e) => updateCancha(c.id, e.target.value)}
                />
                <button className="player__del" onClick={() => removeCancha(c.id)} aria-label="Quitar">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* Horarios */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Franjas horarias</h3>
              {editable && (
                <div className="cfg-actions">
                  <button className="btn btn--add" onClick={sortHorarios}>
                    Ordenar
                  </button>
                  <button className="btn btn--add" onClick={addHorario}>
                    + Franja
                  </button>
                </div>
              )}
            </div>

            <div className="cfg-dows">
              <button
                type="button"
                className={`cfg-dow ${dow === null ? 'is-active' : ''}`}
                onClick={() => setDow(null)}
              >
                Por defecto
              </button>
              {DOW.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`cfg-dow ${dow === d.id ? 'is-active' : ''} ${
                    Array.isArray(byDow[d.id]) ? 'has-override' : ''
                  }`}
                  onClick={() => setDow(d.id)}
                  title={Array.isArray(byDow[d.id]) ? 'Tiene horario propio' : 'Usa el por defecto'}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <p className="cfg-hint">
              {dow === null
                ? 'Horario base que usan todos los días sin uno propio. Cada franja es independiente (1 h, 1 h 30, lo que necesites).'
                : hasOverride
                  ? 'Este día tiene su propio horario.'
                  : 'Este día usa el horario por defecto.'}
            </p>

            {dow !== null && (
              <div className="cfg-dow-actions">
                {hasOverride ? (
                  <button className="btn btn--add" onClick={usarDefaultDow}>
                    Volver al horario por defecto
                  </button>
                ) : (
                  <button className="btn btn--add" onClick={personalizarDow}>
                    Personalizar este día
                  </button>
                )}
              </div>
            )}

            {editable &&
              horarios.map((h, idx) => (
              <div className="cfg-row cfg-row--horario" key={h.id}>
                <input
                  className="cfg-input cfg-input--time"
                  placeholder="14:00"
                  value={h.desde || ''}
                  onChange={(e) => updateHorario(h.id, { desde: e.target.value })}
                  onBlur={(e) => updateHorario(h.id, { desde: normalizeTime(e.target.value) })}
                />
                <span className="cfg-sep">a</span>
                <input
                  className="cfg-input cfg-input--time"
                  placeholder="15:30"
                  value={h.hasta || ''}
                  onChange={(e) => updateHorario(h.id, { hasta: e.target.value })}
                  onBlur={(e) => updateHorario(h.id, { hasta: normalizeTime(e.target.value) })}
                />
                <div className="cfg-move">
                  <button className="qty-btn" onClick={() => moveHorario(idx, -1)} aria-label="Subir">
                    ↑
                  </button>
                  <button className="qty-btn" onClick={() => moveHorario(idx, 1)} aria-label="Bajar">
                    ↓
                  </button>
                </div>
                <button className="player__del" onClick={() => removeHorario(h.id)} aria-label="Quitar">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* Productos */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Productos</h3>
              <button className="btn btn--add" onClick={addProducto}>
                + Producto
              </button>
            </div>
            {(draft.productos || []).map((p) => (
              <div className="cfg-row cfg-row--producto" key={p.id}>
                <input
                  className="cfg-input"
                  placeholder="Nombre del producto"
                  value={p.nombre}
                  onChange={(e) => updateProducto(p.id, { nombre: e.target.value })}
                />
                <input
                  className="cfg-input cfg-input--price"
                  inputMode="numeric"
                  placeholder="$"
                  value={p.precio}
                  onChange={(e) => updateProducto(p.id, { precio: e.target.value.replace(/[^\d]/g, '') })}
                />
                <button className="player__del" onClick={() => removeProducto(p.id)} aria-label="Quitar">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* Jugadores */}
          <JugadoresSection
            jugadores={jugadores}
            onSave={onSaveJugador}
            onDelete={onDeleteJugador}
          />
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Directorio de jugadores. A diferencia del resto del modal, persiste cada
// cambio de inmediato (no espera al botón Guardar) porque vive en su propia
// colección. Edita una copia local sembrada al abrir; las altas automáticas que
// ocurran mientras el modal está abierto aparecen la próxima vez que se abre.
function JugadoresSection({ jugadores, onSave, onDelete }) {
  const [list, setList] = useState(() =>
    [...jugadores].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
  )
  // Id de la fila recién agregada: la enfocamos para que la lista haga scroll
  // sola hasta ella y se pueda escribir sin buscarla.
  const [addedId, setAddedId] = useState(null)

  const patch = (id, p) => setList((l) => l.map((j) => (j.id === id ? { ...j, ...p } : j)))

  // El nuevo jugador aparece arriba, listo para escribir.
  const add = () => {
    const nuevo = { id: uid(), nombre: '', activo: true, creado: Date.now() }
    setList((l) => [nuevo, ...l])
    setAddedId(nuevo.id)
  }

  const commit = (j) => {
    const nombre = (j.nombre || '').trim()
    if (!nombre) return
    const clave = normalizeNombre(nombre)
    // Si el nombre ya existe (sin distinguir mayúsculas, acentos ni comas) no se
    // vuelve a cargar: descartamos esta fila en lugar de duplicar.
    const duplicado = list.some((o) => o.id !== j.id && normalizeNombre(o.nombre) === clave)
    if (duplicado) {
      setList((l) => l.filter((x) => x.id !== j.id))
      return
    }
    onSave?.({ ...j, nombre })
  }

  const toggleActivo = (j) => {
    const next = { ...j, activo: j.activo === false }
    patch(j.id, { activo: next.activo })
    if ((j.nombre || '').trim()) onSave?.(next)
  }

  const remove = (id) => {
    setList((l) => l.filter((j) => j.id !== id))
    onDelete?.(id)
  }

  return (
    <section className="cfg-section">
      <div className="cfg-section__head">
        <h3 className="cfg-section__title">Jugadores</h3>
        <button className="btn btn--add" onClick={add}>
          + Jugador
        </button>
      </div>
      <p className="cfg-hint">
        Estos nombres aparecen como sugerencia al anotar turnos y consumos. También se
        agregan solos cuando escribís un nombre nuevo. Los cambios se guardan al instante.
      </p>
      {list.length === 0 ? (
        <p className="consumos__empty muted">Todavía no hay jugadores en el directorio.</p>
      ) : (
        list.map((j) => (
          <div className="cfg-row" key={j.id}>
            <input
              className="cfg-input"
              placeholder="Nombre del jugador"
              value={j.nombre || ''}
              autoFocus={j.id === addedId}
              onChange={(e) => patch(j.id, { nombre: e.target.value })}
              onBlur={() => commit(j)}
            />
            <button
              type="button"
              className={`btn btn--ghost-sm ${j.activo === false ? 'is-off' : ''}`}
              onClick={() => toggleActivo(j)}
              title={j.activo === false ? 'Inactivo (no se sugiere)' : 'Activo'}
            >
              {j.activo === false ? 'Inactivo' : 'Activo'}
            </button>
            <button className="player__del" onClick={() => remove(j.id)} aria-label="Quitar">
              ×
            </button>
          </div>
        ))
      )}
    </section>
  )
}
