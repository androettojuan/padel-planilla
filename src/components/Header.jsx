import { formatMoney } from '../utils/helpers'

export default function Header({ club, totals, user, onSignOut, onOpenConfig }) {
  return (
    <header className="header">
      <div className="header__brand">
        <img className="header__logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div>
          <h1 className="header__title">{club?.nombre || 'Planilla de Turnos'}</h1>
          {club?.ubicacion && <p className="header__subtitle">{club.ubicacion}</p>}
        </div>
      </div>
      <div className="header__right">
        <div className="header__total">
          <span className="header__total-label">Total del día</span>
          <span className="header__total-value">{formatMoney(totals.total)}</span>
        </div>
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
