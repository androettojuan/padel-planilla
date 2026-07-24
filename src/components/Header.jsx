import { formatMoney } from '../utils/helpers'

export default function Header({
  club,
  clubs = [],
  onCambiarClub,
  totals,
  user,
  superAdmin,
  onSignOut,
  onOpenConfig,
  onOpenAdmin,
}) {
  return (
    <header className="header">
      <div className="header__brand">
        <img className="header__logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
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
        {superAdmin && onOpenAdmin && (
          <button
            className="header__config"
            onClick={onOpenAdmin}
            aria-label="Administración de clubes"
            title="Administración de clubes"
          >
            ★
          </button>
        )}
        <button className="header__config" onClick={onOpenConfig} aria-label="Configuración" title="Configuración">
          ⚙
        </button>
        {user && onSignOut && (
          <button
            className="header__config"
            onClick={onSignOut}
            aria-label="Cerrar sesión"
            title={`Cerrar sesión (${user.email})`}
          >
            ⎋
          </button>
        )}
      </div>
    </header>
  )
}
