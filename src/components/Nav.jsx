import { RUTAS_VISIBLES } from '../hooks/useRuta'

/**
 * Pestañas de las secciones. La de Stock lleva un punto cuando hay algo para
 * reponer, para que se vea sin entrar.
 */
export default function Nav({ ruta, onIr, avisos = {} }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {RUTAS_VISIBLES.map((r) => (
        <button
          key={r.id}
          className={`nav__tab ${ruta === r.id ? 'is-active' : ''}`}
          onClick={() => onIr(r.id)}
          aria-current={ruta === r.id ? 'page' : undefined}
        >
          <span className="nav__icono" aria-hidden="true">
            {r.icono}
          </span>
          <span className="nav__label">{r.titulo}</span>
          {avisos[r.id] && <span className="nav__aviso" aria-label="Requiere atención" />}
        </button>
      ))}
    </nav>
  )
}
