import { useState } from 'react'
import { uid, normalizeTime } from '../utils/helpers'
import { generarFranjas, reglaDeFranjas, horarioLabel } from '../data/defaults'
import { esReserva, MODO_JUGADORES, MODO_RESERVA, modoPlanilla } from '../utils/turnos'
import { useCambiosSinGuardar } from '../hooks/useCambiosSinGuardar'
import BotonBorrar from '../components/BotonBorrar'
import Pantalla from '../components/Pantalla'

// Con qué se compara para saber si hay algo sin guardar. Se mira el contenido y
// no las referencias: mover una franja y volverla a su lugar no deja "cambios".
const firma = (config, club) => JSON.stringify([config, club])

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

export default function ConfigPage({ config, club, onSave, onSaveClub, bloquearSalida, ir }) {
  const [draft, setDraft] = useState(() => structuredClone(config))
  // El nombre y la ubicación viven en el documento del club, no en su config.
  const [clubDraft, setClubDraft] = useState(() => ({
    nombre: club?.nombre || '',
    ubicacion: club?.ubicacion || '',
  }))
  // Cómo estaba la configuración la última vez que se guardó (o al entrar).
  const [guardadoComo, setGuardadoComo] = useState(() =>
    firma(config, { nombre: club?.nombre || '', ubicacion: club?.ubicacion || '' }),
  )
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  const hayCambios = firma(draft, clubDraft) !== guardadoComo
  const { pendiente, salir, quedarse } = useCambiosSinGuardar({ hayCambios, bloquearSalida, ir })
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

  const handleSave = async () => {
    setSaving(true)
    setError(null)
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
      modoPlanilla: modoPlanilla(draft),
    }
    const datosClub = {
      nombre: clubDraft.nombre.trim() || club?.nombre || 'Club',
      ubicacion: clubDraft.ubicacion.trim(),
    }
    try {
      await onSave(clean)
      if (onSaveClub) await onSaveClub(datosClub)
      // Lo que se ve pasa a ser lo guardado —con las horas ya normalizadas— y esa
      // queda como la versión limpia contra la que se comparan los cambios.
      setDraft(clean)
      setClubDraft(datosClub)
      setGuardadoComo(firma(clean, datosClub))
      // Ya no hay modal que cerrar: se avisa en el pie y la sección queda abierta.
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
      return true
    } catch (err) {
      // Si el guardado falla, lo que se escribió sigue en pantalla: el aviso es
      // para que no se salga creyendo que quedó guardado.
      setError(err)
      return false
    } finally {
      setSaving(false)
    }
  }

  // Desde el cartel de salida: guarda y recién entonces se va.
  const guardarYSalir = async (destino) => {
    if (await handleSave()) salir(destino)
  }

  return (
    <Pantalla
      titulo="Configuración"
      descripcion="Los datos del club, sus canchas y los horarios de los turnos."
      footer={
        <>
          {error ? (
            <span className="cfg-pendiente">No se pudo guardar: {error.message}</span>
          ) : guardado ? (
            <span className="muted">Cambios guardados.</span>
          ) : (
            hayCambios && <span className="cfg-pendiente">Tenés cambios sin guardar.</span>
          )}
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || !hayCambios}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      {pendiente && (
        <div className="salir-aviso" role="dialog" aria-modal="true" aria-label="Cambios sin guardar">
          <div className="salir-aviso__caja">
            <p className="salir-aviso__titulo">Tenés cambios sin guardar</p>
            <p className="salir-aviso__texto">
              Si salís de Configuración ahora, queda como estaba antes de tus cambios.
            </p>
            <div className="salir-aviso__acciones">
              <button className="btn btn--ghost-sm" onClick={quedarse}>
                Seguir editando
              </button>
              <span className="salir-aviso__sep" />
              <button className="btn" onClick={() => salir(pendiente)} disabled={saving}>
                Salir sin guardar
              </button>
              <button
                className="btn btn--primary"
                onClick={() => guardarYSalir(pendiente)}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar y salir'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <BotonBorrar onConfirm={() => removeCancha(c.id)} title="Quitar cancha" />
              </div>
            ))}
          </section>

          {/* Cómo se anota cada turno */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Cómo se anota cada turno</h3>
            </div>
            <div className="cfg-modos">
              <button
                className={`cfg-modo ${!esReserva(draft) ? 'is-active' : ''}`}
                onClick={() => set({ modoPlanilla: MODO_JUGADORES })}
              >
                <span className="cfg-modo__titulo">Por jugadores</span>
                <span className="cfg-modo__desc">
                  Cuatro líneas por turno, una por jugador, cada una con su monto y su forma de
                  pago. Sirve cuando se le cobra a cada uno por separado.
                </span>
              </button>
              <button
                className={`cfg-modo ${esReserva(draft) ? 'is-active' : ''}`}
                onClick={() => set({ modoPlanilla: MODO_RESERVA })}
              >
                <span className="cfg-modo__titulo">Por reserva</span>
                <span className="cfg-modo__desc">
                  Una sola línea: quién reservó y cuánto sale el turno. Los pagos se cargan
                  encima —cada uno con su nombre y su medio— hasta cubrirlo.
                </span>
              </button>
            </div>
            <p className="cfg-hint">
              Cambiar de modo no toca lo ya cargado: cada planilla se sigue mostrando como se
              anotó.
            </p>
          </section>

          {/* Horarios */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Horarios de los turnos</h3>
            </div>
            <p className="cfg-hint">
              Son los turnos que aparecen en la planilla de cada día: a qué hora
              empieza cada uno y cuánto dura.
            </p>

            {/* Paso 1: de qué cancha y de qué día es el horario que se edita. */}
            <p className="cfg-paso">1 · ¿De qué canchas es este horario?</p>
            <div className="cfg-scopes">
              <button
                type="button"
                className={`cfg-scope ${alcance === null ? 'is-active' : ''}`}
                onClick={() => setAlcance(null)}
              >
                Todas las canchas
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
            <p className="cfg-hint">
              {alcance === null
                ? 'Este es el horario general del club. El punto verde marca las canchas que abren en otro horario.'
                : propio
                  ? `${cancha?.nombre || 'Esta cancha'} abre en su propio horario, distinto al del club.`
                  : `${cancha?.nombre || 'Esta cancha'} usa el horario general del club.`}
            </p>

            {alcance !== null && (
              <div className="cfg-dow-actions">
                {propio ? (
                  <button className="btn btn--add" onClick={volverAlDelClub}>
                    Volver a usar el horario del club
                  </button>
                ) : (
                  <button className="btn btn--add" onClick={darHorarioPropio}>
                    Darle a esta cancha un horario propio
                  </button>
                )}
              </div>
            )}

            <p className="cfg-paso">2 · ¿Qué días?</p>
            <div className="cfg-dows">
              <button
                type="button"
                className={`cfg-dow ${dow === null ? 'is-active' : ''}`}
                onClick={() => setDow(null)}
              >
                Todos los días
              </button>
              {DOW.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`cfg-dow ${dow === d.id ? 'is-active' : ''} ${
                    Array.isArray(byDow[d.id]) ? 'has-override' : ''
                  }`}
                  onClick={() => setDow(d.id)}
                  title={Array.isArray(byDow[d.id]) ? 'Tiene horario propio' : 'Usa el de todos los días'}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <p className="cfg-hint">
              {!propio
                ? 'Elegí primero darle horario propio a esta cancha para poder editarlo.'
                : dow === null
                  ? 'Estos turnos valen para toda la semana. Si algún día es distinto, elegilo arriba y personalizalo.'
                  : hasOverride
                    ? 'Este día tiene turnos propios, distintos al resto de la semana.'
                    : 'Este día usa los mismos turnos que el resto de la semana.'}
            </p>

            {editable && (
              <>
                <p className="cfg-paso">3 · ¿Desde cuándo, hasta cuándo y cada cuánto?</p>
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
                  Generar horarios
                </button>
                <p className="cfg-regla__pie">
                  Al generar se reemplaza la lista de abajo por los turnos que salen de estos
                  datos. Después podés corregir, borrar o agregar los que quieras.
                </p>
                {!coincide && horarios.length > 0 && (
                  <p className="cfg-regla__aviso">
                    Los turnos de abajo no coinciden con estos datos: si generás, se reemplazan.
                  </p>
                )}
                </div>
              </>
            )}

            {dow !== null && (
              <div className="cfg-dow-actions">
                {hasOverride ? (
                  <button className="btn btn--add" onClick={usarDefaultDow}>
                    Que este día use el horario de siempre
                  </button>
                ) : (
                  <button className="btn btn--add" onClick={personalizarDow}>
                    Darle a este día un horario propio
                  </button>
                )}
              </div>
            )}

            {editable && (
              <div className="cfg-section__head cfg-lista-head">
                <h4 className="cfg-lista-titulo">
                  Turnos del día{horarios.length > 0 && <span> · {horarios.length}</span>}
                </h4>
                <div className="cfg-actions">
                  <button className="btn btn--add" onClick={sortHorarios}>
                    Ordenar por hora
                  </button>
                  <button className="btn btn--add" onClick={addHorario}>
                    + Agregar turno
                  </button>
                </div>
              </div>
            )}

            {editable && (
              <p className="cfg-hint">
                Si hace falta, cambiá esta lista a mano: los turnos pueden durar distinto entre sí.
              </p>
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
                <BotonBorrar onConfirm={() => removeHorario(h.id)} title="Quitar turno" />
              </div>
            ))}

            {/* Horario heredado: se muestra para saber cuál se está usando. */}
            {!editable && (
              <>
                <h4 className="cfg-lista-titulo">Turnos que usa este día</h4>
                <div className="cfg-franjas-ro">
                  {horarios.length ? (
                    horarios.map((h) => (
                      <span className="cfg-franja-ro" key={h.id}>
                        {horarioLabel(h)}
                      </span>
                    ))
                  ) : (
                    <span className="muted">Todavía no hay turnos cargados.</span>
                  )}
                </div>
              </>
            )}
          </section>

    </Pantalla>
  )
}
