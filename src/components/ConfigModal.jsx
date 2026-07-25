import { useState } from 'react'
import { uid, normalizeTime, normalizeNombre } from '../utils/helpers'
import { generarFranjas, reglaDeFranjas, horarioLabel } from '../data/defaults'

// Duraciones ofrecidas al generar las franjas. Cualquier otra combinación se
// arma editando las franjas a mano.
const DURACIONES = [
  { min: 60, label: '1 h' },
  { min: 90, label: '1 h 30' },
  { min: 120, label: '2 h' },
]

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
  club,
  onSave,
  onSaveClub,
  onClose,
  jugadores = [],
  onSaveJugador,
  onDeleteJugador,
}) {
  const [draft, setDraft] = useState(() => structuredClone(config))
  // El nombre y la ubicación viven en el documento del club, no en su config.
  const [clubDraft, setClubDraft] = useState(() => ({
    nombre: club?.nombre || '',
    ubicacion: club?.ubicacion || '',
  }))
  const [saving, setSaving] = useState(false)
  // Pestaña de horarios activa: null = "Por defecto", o un día de la semana (0-6).
  const [dow, setDow] = useState(null)
  // Horario que se está editando: null = el del club, o el id de una cancha.
  const [alcance, setAlcance] = useState(null)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // ---- Canchas ----
  const addCancha = () =>
    set({ canchas: [...draft.canchas, { id: uid(), nombre: `Cancha ${draft.canchas.length + 1}` }] })
  const updateCancha = (id, nombre) =>
    set({ canchas: draft.canchas.map((c) => (c.id === id ? { ...c, nombre } : c)) })
  const removeCancha = (id) => set({ canchas: draft.canchas.filter((c) => c.id !== id) })

  // ---- Horarios ----
  //
  // Se editan en dos ejes: el "alcance" (el club o una cancha con horario
  // propio) y, dentro de cada uno, el día de la semana. Una cancha sin lista
  // propia hereda la del club y se muestra en gris.
  const setCancha = (id, patch) =>
    set({ canchas: draft.canchas.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  const cancha = alcance === null ? null : draft.canchas.find((c) => c.id === alcance)
  // Ojo: cada acción arma un solo patch, porque dos setDuenio seguidos parten
  // del mismo `draft` y el segundo pisaría al primero.
  const setDuenio = (patch) => (alcance === null ? set(patch) : setCancha(alcance, patch))
  // El club siempre tiene horario propio; una cancha, solo si se lo dieron.
  const propio = alcance === null || Array.isArray(cancha?.horarios)
  const duenio = propio ? (alcance === null ? draft : cancha) : draft

  const byDow = duenio?.horariosByDow || {}
  const reglasByDow = duenio?.reglaByDow || {}
  const hasOverride = dow !== null && Array.isArray(byDow[dow])
  const base = duenio?.horarios || []
  // Lista que se está editando: el override del día, o el horario por defecto.
  const horarios = dow === null || !hasOverride ? base : byDow[dow]
  // Solo es editable la pestaña "Por defecto" o un día que ya tiene override,
  // y siempre que el alcance tenga horario propio.
  const editable = propio && (dow === null || hasOverride)
  // Cada horario tiene su regla: la del día si es un día personalizado, la del
  // alcance si no. Si nunca se guardó, se deduce de las franjas que hay.
  const reglaGuardada = dow === null || !hasOverride ? duenio?.regla : reglasByDow[dow]
  const regla = reglaGuardada || reglaDeFranjas(horarios)

  const setHorarios = (list) => {
    if (dow === null) setDuenio({ horarios: list })
    else setDuenio({ horariosByDow: { ...byDow, [dow]: list } })
  }
  const personalizarDow = () =>
    setDuenio({
      horariosByDow: { ...byDow, [dow]: structuredClone(base) },
      reglaByDow: { ...reglasByDow, [dow]: { ...regla } },
    })
  const usarDefaultDow = () => {
    const next = { ...byDow }
    delete next[dow]
    const nextReglas = { ...reglasByDow }
    delete nextReglas[dow]
    setDuenio({ horariosByDow: next, reglaByDow: nextReglas })
  }

  // Darle horario propio a una cancha copia el del club con los mismos ids, así
  // los turnos ya cargados siguen cayendo en su franja.
  const darHorarioPropio = () =>
    setCancha(alcance, {
      horarios: structuredClone(draft.horarios || []),
      horariosByDow: structuredClone(draft.horariosByDow || {}),
      regla: structuredClone(draft.regla || reglaDeFranjas(draft.horarios || [])),
      reglaByDow: structuredClone(draft.reglaByDow || {}),
    })
  const volverAlDelClub = () =>
    setCancha(alcance, { horarios: null, horariosByDow: null, regla: null, reglaByDow: null })

  // Si el club venía con franjas de otra duración (config vieja o editada a
  // mano), esa duración se suma a las opciones para no perderla al generar.
  const duracion = Number(regla.duracion) || 90
  const duraciones = DURACIONES.some((d) => d.min === duracion)
    ? DURACIONES
    : [...DURACIONES, { min: duracion, label: `${duracion} min` }].sort((a, b) => a.min - b.min)

  const setRegla = (patch) => {
    const nueva = { ...regla, ...patch }
    if (dow === null || !hasOverride) setDuenio({ regla: nueva })
    else setDuenio({ reglaByDow: { ...reglasByDow, [dow]: nueva } })
  }

  // La lista puede haberse editado a mano después de generarla; se avisa para
  // que quede claro que "Generar" la va a reemplazar por otra cosa.
  const generadas = generarFranjas(regla, horarios)
  const coincide =
    generadas.length === horarios.length &&
    generadas.every((h, i) => h.desde === horarios[i].desde && h.hasta === horarios[i].hasta)
  // Genera las franjas del horario activo a partir de la regla. Conserva el id
  // de las que ya existían con el mismo rango.
  const generarHorarios = () => {
    const nueva = generarFranjas(
      { ...regla, desde: normalizeTime(regla.desde), hasta: normalizeTime(regla.hasta) },
      horarios,
    )
    if (!nueva.length) return
    if (
      horarios.length &&
      !window.confirm('Se reemplazan las franjas de este horario por las generadas. ¿Seguir?')
    )
      return
    // La regla y las franjas se guardan juntas: la regla queda describiendo
    // exactamente lo que se generó.
    if (dow === null || !hasOverride) setDuenio({ regla: { ...regla }, horarios: nueva })
    else
      setDuenio({
        reglaByDow: { ...reglasByDow, [dow]: { ...regla } },
        horariosByDow: { ...byDow, [dow]: nueva },
      })
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
    const normByDow = (byDow) => {
      const out = {}
      for (const [k, v] of Object.entries(byDow || {})) out[k] = normList(v)
      return out
    }
    const normRegla = (r) =>
      r ? { ...r, desde: normalizeTime(r.desde), hasta: normalizeTime(r.hasta), duracion: Number(r.duracion) || 90 } : null
    const normReglaByDow = (byDow) => {
      const out = {}
      for (const [k, v] of Object.entries(byDow || {})) out[k] = normRegla(v)
      return out
    }
    // Las canchas sin horario propio guardan null: así heredan el del club.
    const normCancha = (c) =>
      Array.isArray(c.horarios)
        ? {
            ...c,
            horarios: normList(c.horarios),
            horariosByDow: normByDow(c.horariosByDow),
            regla: normRegla(c.regla),
            reglaByDow: normReglaByDow(c.reglaByDow),
          }
        : { ...c, horarios: null, horariosByDow: null, regla: null, reglaByDow: null }
    const clean = {
      ...draft,
      canchas: draft.canchas.map(normCancha),
      regla: normRegla(draft.regla) || reglaDeFranjas(draft.horarios || []),
      reglaByDow: normReglaByDow(draft.reglaByDow),
      horarios: normList(draft.horarios),
      horariosByDow: normByDow(draft.horariosByDow),
      productos: (draft.productos || []).map((p) => ({ ...p, precio: Number(p.precio) || 0 })),
    }
    try {
      await onSave(clean)
      if (onSaveClub) {
        await onSaveClub({
          nombre: clubDraft.nombre.trim() || club?.nombre || 'Club',
          ubicacion: clubDraft.ubicacion.trim(),
        })
      }
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
                value={clubDraft.nombre}
                onChange={(e) => setClubDraft((c) => ({ ...c, nombre: e.target.value }))}
              />
              <input
                className="cfg-input"
                placeholder="Ubicación"
                value={clubDraft.ubicacion}
                onChange={(e) => setClubDraft((c) => ({ ...c, ubicacion: e.target.value }))}
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

            {/* Alcance: el horario del club o el propio de una cancha. */}
            <div className="cfg-scopes">
              <button
                type="button"
                className={`cfg-scope ${alcance === null ? 'is-active' : ''}`}
                onClick={() => setAlcance(null)}
              >
                Club
              </button>
              {draft.canchas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cfg-scope ${alcance === c.id ? 'is-active' : ''} ${
                    Array.isArray(c.horarios) ? 'has-override' : ''
                  }`}
                  onClick={() => setAlcance(c.id)}
                  title={Array.isArray(c.horarios) ? 'Tiene horario propio' : 'Usa el del club'}
                >
                  {c.nombre || 'Cancha'}
                </button>
              ))}
            </div>

            {alcance !== null && (
              <div className="cfg-dow-actions">
                {propio ? (
                  <button className="btn btn--add" onClick={volverAlDelClub}>
                    Usar el horario del club
                  </button>
                ) : (
                  <button className="btn btn--add" onClick={darHorarioPropio}>
                    Darle horario propio a esta cancha
                  </button>
                )}
              </div>
            )}

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
              {!propio
                ? 'Esta cancha usa el horario del club. Dale uno propio si abre en otros horarios.'
                : dow === null
                  ? 'Horario base que usan todos los días sin uno propio. Poné a qué hora abre y cierra, cuánto dura el turno y generá las franjas; después podés retocarlas.'
                  : hasOverride
                    ? 'Este día tiene su propio horario.'
                    : 'Este día usa el horario por defecto.'}
            </p>

            {editable && (
              <div className="cfg-regla">
                <label className="cfg-regla__campo">
                  <span>Abre</span>
                  <input
                    className="cfg-input cfg-input--time"
                    placeholder="14:00"
                    value={regla.desde || ''}
                    onChange={(e) => setRegla({ desde: e.target.value })}
                    onBlur={(e) => setRegla({ desde: normalizeTime(e.target.value) })}
                  />
                </label>
                <label className="cfg-regla__campo">
                  <span>Cierra</span>
                  <input
                    className="cfg-input cfg-input--time"
                    placeholder="23:00"
                    value={regla.hasta || ''}
                    onChange={(e) => setRegla({ hasta: e.target.value })}
                    onBlur={(e) => setRegla({ hasta: normalizeTime(e.target.value) })}
                  />
                </label>
                <label className="cfg-regla__campo">
                  <span>Turnos de</span>
                  <select
                    className="cfg-input cfg-input--dur"
                    value={String(regla.duracion || 90)}
                    onChange={(e) => setRegla({ duracion: Number(e.target.value) })}
                  >
                    {duraciones.map((d) => (
                      <option key={d.min} value={d.min}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn--primary cfg-regla__btn" onClick={generarHorarios}>
                  Generar franjas
                </button>
                {!coincide && horarios.length > 0 && (
                  <p className="cfg-regla__aviso">
                    Las franjas de abajo no siguen esta regla: generarlas las reemplaza.
                  </p>
                )}
              </div>
            )}

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

            {/* Horario heredado: se muestra para saber cuál se está usando. */}
            {!editable && (
              <div className="cfg-franjas-ro">
                {horarios.length ? (
                  horarios.map((h) => (
                    <span className="cfg-franja-ro" key={h.id}>
                      {horarioLabel(h)}
                    </span>
                  ))
                ) : (
                  <span className="muted">Sin franjas cargadas.</span>
                )}
              </div>
            )}
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
