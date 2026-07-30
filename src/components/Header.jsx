import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../utils/helpers'

export default function Header({
  club,
  clubs = [],
  onCambiarClub,
  totals,
  user,
  superAdmin,
  onSignOut,
  onOpenClubes,
}) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  // El menú de la cuenta se cierra al tocar afuera o con Escape, como cualquier
  // menú del sistema.
  useEffect(() => {
    if (!menu) return
    const fuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    const esc = (e) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])

  const inicial = (user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="header">
      <div className="header__brand">
        <img
          className="header__logo"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <div>
          {/* Con más de un club el título es un selector para cambiar de club. */}
          {clubs.length > 1 ? (
            <select
              className="header__club-select"
              value={club?.id || ''}
              onChange={(e) => onCambiarClub(e.target.value)}
              aria-label="Club"
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="header__title">{club?.nombre || 'Planilla de Turnos'}</h1>
          )}
          {club?.ubicacion && <p className="header__subtitle">{club.ubicacion}</p>}
        </div>
      </div>
      <div className="header__right">
        <div className="header__total">
          <span className="header__total-label">Total del día</span>
          <span className="header__total-value">{formatMoney(totals.total)}</span>
        </div>

        {user && (
          <div className="usuario" ref={menuRef}>
            <button
              className="usuario__btn"
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              title={user.email}
            >
              <span className="usuario__avatar" aria-hidden="true">
                {inicial}
              </span>
              <span className="usuario__email">{user.email}</span>
              <span className="usuario__flecha" aria-hidden="true">
                ▾
              </span>
            </button>

            {menu && (
              <div className="usuario__menu" role="menu">
                <p className="usuario__menu-email">{user.email}</p>
                {superAdmin && onOpenClubes && (
                  <button
                    className="usuario__item"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      onOpenClubes()
                    }}
                  >
                    ★ Administrar clubes
                  </button>
                )}
                {onSignOut && (
                  <button
                    className="usuario__item usuario__item--salir"
                    role="menuitem"
                    onClick={onSignOut}
                  >
                    Cerrar sesión
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
