import { formatMoney } from '../utils/helpers'

export default function Header({ club, totals }) {
  return (
    <header className="header">
      <div className="header__brand">
        <img className="header__logo" src="/logo.png" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div>
          <h1 className="header__title">{club?.nombre || 'Planilla de Turnos'}</h1>
          {club?.ubicacion && <p className="header__subtitle">{club.ubicacion}</p>}
        </div>
      </div>
      <div className="header__total">
        <span className="header__total-label">Total del día</span>
        <span className="header__total-value">{formatMoney(totals.total)}</span>
      </div>
    </header>
  )
}
