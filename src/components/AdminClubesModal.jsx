import { useEffect, useState } from 'react'
import {
  loadTodosLosClubs,
  crearClub,
  actualizarClub,
  loadMiembros,
  agregarMiembro,
  quitarMiembro,
} from '../firebase/clubs'
import { slugify } from '../utils/helpers'

// Panel del super admin: crear clubes y decidir quién entra a cada uno.
// El alta de un usuario es simplemente sumar su email al club; la primera vez
// que entre con Google va a encontrar la planilla del club esperándolo.
export default function AdminClubesModal({ onClose, onCambios, emailActual }) {
  const [clubs, setClubs] = useState(null) // null = cargando
  const [error, setError] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [cargandoMiembros, setCargandoMiembros] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoUbicacion, setNuevoUbicacion] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [guardando, setGuardando] = useState(false)

  const recargarClubs = async () => {
    try {
      setClubs(await loadTodosLosClubs())
    } catch (e) {
      setError(e)
      setClubs([])
    }
  }

  useEffect(() => {
    recargarClubs()
  }, [])

  useEffect(() => {
    if (!seleccionado) return
    let active = true
    setCargandoMiembros(true)
    loadMiembros(seleccionado)
      .then((m) => active && setMiembros(m))
      .catch((e) => active && setError(e))
      .finally(() => active && setCargandoMiembros(false))
    return () => {
      active = false
    }
  }, [seleccionado])

  const club = (clubs || []).find((c) => c.id === seleccionado) || null

  const handleCrear = async (e) => {
    e.preventDefault()
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    // El id sale del nombre: queda legible en las rutas de Firestore.
    const id = slugify(nombre)
    setGuardando(true)
    setError(null)
    try {
      await crearClub({ id, nombre, ubicacion: nuevoUbicacion.trim() })
      setNuevoNombre('')
      setNuevoUbicacion('')
      await recargarClubs()
      setSeleccionado(id)
      onCambios?.()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  const handleAgregarMiembro = async (e) => {
    e.preventDefault()
    const email = nuevoEmail.trim().toLowerCase()
    if (!email || !seleccionado) return
    setGuardando(true)
    setError(null)
    try {
      await agregarMiembro(seleccionado, email)
      setNuevoEmail('')
      setMiembros(await loadMiembros(seleccionado))
      onCambios?.()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  const handleQuitar = async (email) => {
    setError(null)
    try {
      await quitarMiembro(seleccionado, email)
      setMiembros(await loadMiembros(seleccionado))
      onCambios?.()
    } catch (err) {
      setError(err)
    }
  }

  const handleActivo = async (activo) => {
    setError(null)
    try {
      await actualizarClub(seleccionado, { activo })
      await recargarClubs()
      onCambios?.()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Administración de clubes</h2>
          <button className="player__del" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal__body">
          {error && <div className="banner banner--error">{error.message}</div>}

          {/* Alta de club */}
          <section className="cfg-section">
            <h3 className="cfg-section__title">Nuevo club</h3>
            <form className="cfg-row" onSubmit={handleCrear}>
              <input
                className="cfg-input"
                placeholder="Nombre del club"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
              <input
                className="cfg-input"
                placeholder="Ubicación"
                value={nuevoUbicacion}
                onChange={(e) => setNuevoUbicacion(e.target.value)}
              />
              <button className="btn btn--primary" disabled={guardando || !nuevoNombre.trim()}>
                Crear
              </button>
            </form>
            {nuevoNombre.trim() && (
              <p className="cfg-hint">Se guardará como clubs/{slugify(nuevoNombre)}</p>
            )}
          </section>

          {/* Listado de clubes */}
          <section className="cfg-section">
            <h3 className="cfg-section__title">Clubes</h3>
            {clubs === null && <p className="cfg-hint">Cargando…</p>}
            {clubs?.length === 0 && <p className="cfg-hint">Todavía no hay clubes.</p>}
            {clubs?.map((c) => (
              <div
                key={c.id}
                className={`cfg-row admin-club${seleccionado === c.id ? ' admin-club--sel' : ''}`}
                onClick={() => setSeleccionado(c.id)}
              >
                <span className="admin-club__nombre">
                  {c.nombre}
                  {c.activo === false && <em className="admin-club__off"> (inactivo)</em>}
                </span>
                <span className="admin-club__id">{c.id}</span>
              </div>
            ))}
          </section>

          {/* Usuarios del club elegido */}
          {club && (
            <section className="cfg-section">
              <div className="cfg-section__head">
                <h3 className="cfg-section__title">Usuarios de {club.nombre}</h3>
                <button className="btn btn--ghost" onClick={() => handleActivo(club.activo === false)}>
                  {club.activo === false ? 'Reactivar club' : 'Desactivar club'}
                </button>
              </div>

              <form className="cfg-row" onSubmit={handleAgregarMiembro}>
                <input
                  className="cfg-input"
                  type="email"
                  placeholder="email@gmail.com"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                />
                <button className="btn btn--add" disabled={guardando || !nuevoEmail.trim()}>
                  + Usuario
                </button>
              </form>
              {emailActual && !miembros.some((m) => m.email === emailActual) && (
                <p className="cfg-hint">
                  Para usar la planilla de este club tenés que agregarte vos también
                  ({emailActual}).
                </p>
              )}

              {cargandoMiembros && <p className="cfg-hint">Cargando usuarios…</p>}
              {!cargandoMiembros && miembros.length === 0 && (
                <p className="cfg-hint">El club no tiene usuarios: nadie puede entrar todavía.</p>
              )}
              {miembros.map((m) => (
                <div className="cfg-row" key={m.id || m.email}>
                  <span className="admin-club__nombre">{m.email}</span>
                  <button
                    className="player__del"
                    onClick={() => handleQuitar(m.email)}
                    aria-label={`Quitar ${m.email}`}
                    title="Quitar del club"
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
