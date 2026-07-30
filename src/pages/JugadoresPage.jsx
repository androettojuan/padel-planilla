import { useState } from 'react'
import { uid, normalizeNombre } from '../utils/helpers'
import BotonBorrar from '../components/BotonBorrar'
import Pantalla from '../components/Pantalla'

/**
 * Directorio de jugadores: los nombres que se sugieren al anotar turnos y
 * consumos. Persiste cada cambio de inmediato, sin botón Guardar, porque vive en
 * su propia colección. Edita una copia local sembrada al entrar; las altas
 * automáticas que ocurran mientras tanto aparecen al volver a la sección.
 */
export default function JugadoresPage({ jugadores = [], onSave, onDelete }) {
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
    <Pantalla
      titulo="Jugadores"
      descripcion="Los nombres que se sugieren al anotar turnos y consumos. También se agregan solos cuando escribís uno nuevo, y los cambios se guardan al instante."
      acciones={
        <button className="btn btn--add" onClick={add}>
          + Jugador
        </button>
      }
    >
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
            <BotonBorrar onConfirm={() => remove(j.id)} title="Borrar del directorio" />
          </div>
        ))
      )}
    </Pantalla>
  )
}
