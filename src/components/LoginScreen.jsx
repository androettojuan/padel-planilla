// Pantalla previa al ingreso. Dos estados:
//  - sin usuario: botón para iniciar sesión con Google.
//  - con usuario pero sin club: su email todavía no fue agregado a ningún club.
export default function LoginScreen({ user, onSignIn, onSignOut, error }) {
  const sinClub = !!user

  return (
    <div className="login">
      <div className="login__card">
        <img
          className="login__logo"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <h1 className="login__title">Planilla de Turnos</h1>

        {sinClub ? (
          <>
            <p className="login__text">
              Tu cuenta <b>{user.email}</b> todavía no está habilitada en ningún club.
            </p>
            <p className="login__hint">
              Pedile al administrador que te agregue al club para el que vas a trabajar.
            </p>
            <button className="btn" onClick={onSignOut}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <p className="login__text">Ingresá con tu cuenta de Google para continuar.</p>
            <button className="btn btn--primary login__google" onClick={onSignIn}>
              <span className="login__google-icon">G</span> Iniciar sesión con Google
            </button>
          </>
        )}

        {error && <p className="login__error">{error.message}</p>}
      </div>
    </div>
  )
}
