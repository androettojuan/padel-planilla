// Pantalla previa al ingreso. Dos estados:
//  - sin usuario: botón para iniciar sesión con Google.
//  - con usuario pero no autorizado: aviso para pedir acceso al administrador.
export default function LoginScreen({ user, onSignIn, onSignOut, error, club }) {
  const noAutorizado = !!user

  return (
    <div className="login">
      <div className="login__card">
        <img
          className="login__logo"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <h1 className="login__title">{club?.nombre || 'Planilla de Turnos'}</h1>

        {noAutorizado ? (
          <>
            <p className="login__text">
              Tu cuenta <b>{user.email}</b> todavía no está autorizada para usar la planilla.
            </p>
            <p className="login__hint">Pedile al administrador que te habilite el acceso.</p>
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
