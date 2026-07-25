import { useMemo, useState } from 'react'
import { isFirebaseConfigured, isEmulator } from './firebase/config'
import { actualizarClub } from './firebase/clubs'
import { useSesion } from './hooks/useSesion'
import { ClubProvider } from './hooks/useClub'
import { useConfig } from './hooks/useConfig'
import { useJugadores } from './hooks/useJugadores'
import { usePlanilla } from './hooks/usePlanilla'
import { todayKey } from './utils/helpers'
import { horariosForDate } from './data/defaults'
import Header from './components/Header'
import DateToolbar from './components/DateToolbar'
import CourtsBoard from './components/CourtsBoard'
import ConsumosPanel from './components/ConsumosPanel'
import CuentasPanel from './components/CuentasPanel'
import PanelesDrawer, { SolapaPaneles } from './components/PanelesDrawer'
import ConfigModal from './components/ConfigModal'
import ResumenMensualModal from './components/ResumenMensualModal'
import SaldosModal from './components/SaldosModal'
import AdminClubesModal from './components/AdminClubesModal'
import LoginScreen from './components/LoginScreen'

// A partir de esta cantidad de canchas la planilla se queda con todo el ancho y
// Cuentas/Consumos pasan al cajón lateral. Con tres canchas la columna del
// costado ya deja al tablero sin lugar y aparece el desplazamiento horizontal.
const CANCHAS_ANCHO_COMPLETO = 3

// Ancho cómodo para una cancha (nombre + monto + estado de pago). Más que esto
// solo estira los campos al pedo, así que en pantallas grandes la planilla se
// queda en este ancho y se centra en vez de ocupar todo.
const ANCHO_CANCHA = 400
const ANCHO_COL_HORARIOS = 72
const GAP_CANCHAS = 8
const PADDING_APP = 40
// Más allá de cuatro canchas la planilla no sigue creciendo: las columnas se
// achican hasta su mínimo y, si aun así no entran, el tablero se desplaza.
const CANCHAS_PARA_ANCHO_MAX = 4

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [resumenOpen, setResumenOpen] = useState(false)
  const [saldosOpen, setSaldosOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const sesion = useSesion()
  const {
    user,
    superAdmin,
    clubs,
    club,
    clubId,
    autorizado,
    loading: authLoading,
    error: authError,
    cambiarClub,
    recargarClubs,
    setClubLocal,
    signIn,
    signOut,
  } = sesion

  const { config, saveConfig } = useConfig(clubId)
  const { jugadores, saveJugador, deleteJugador, upsertNombre } = useJugadores(clubId)
  const { planilla, update, loading, error } = usePlanilla(clubId, dateKey)

  const totals = useMemo(() => computeTotals(planilla), [planilla])
  const horarios = useMemo(() => horariosForDate(config, dateKey), [config, dateKey])
  // Sugerencias para autocompletar: directorio (activos) + nombres ya usados hoy.
  const sugerencias = useMemo(() => computeSugerencias(jugadores, planilla), [jugadores, planilla])

  // Nombre y ubicación del club se guardan en clubs/{clubId}, no en su config.
  const saveClub = async (cambios) => {
    setClubLocal(cambios) // optimista
    await actualizarClub(clubId, cambios)
  }

  // Con muchas canchas los paneles se muestran en el cajón lateral en vez de la
  // columna de la derecha; se arman una sola vez y van a donde corresponda.
  const canchas = (config.canchas || []).length
  const anchoCompleto = canchas >= CANCHAS_ANCHO_COMPLETO
  // Tope de ancho según cuántas canchas hay que mostrar: con pocas canchas la
  // planilla queda centrada; con muchas usa toda la pantalla.
  const anchoMax =
    PADDING_APP +
    ANCHO_COL_HORARIOS +
    Math.min(canchas, CANCHAS_PARA_ANCHO_MAX) * (ANCHO_CANCHA + GAP_CANCHAS)
  const paneles = {
    cuentas: <CuentasPanel config={config} planilla={planilla} update={update} />,
    consumos: (
      <ConsumosPanel
        config={config}
        planilla={planilla}
        update={update}
        sugerencias={sugerencias}
        onCommitNombre={upsertNombre}
      />
    ),
  }

  // Antes de autorizar: pantalla de carga / login / sin club asignado.
  if (authLoading) {
    return <div className="loading loading--full">Conectando…</div>
  }
  if (!autorizado) {
    return <LoginScreen user={user} onSignIn={signIn} onSignOut={signOut} error={authError} />
  }

  // Super admin recién llegado: todavía no es miembro de ningún club, así que
  // solo puede administrar (crear clubes y darse de alta en uno).
  if (!clubId) {
    return (
      <div className="app">
        <div className="banner banner--warn">
          Tu cuenta es super admin pero no pertenece a ningún club. Creá uno y agregate como
          usuario para poder usar la planilla.
        </div>
        <div className="login">
          <div className="login__card">
            <h1 className="login__title">Administración</h1>
            <button className="btn btn--primary" onClick={() => setAdminOpen(true)}>
              Abrir administración de clubes
            </button>
            <button className="btn" onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
        {adminOpen && (
          <AdminClubesModal
            emailActual={user?.email}
            onCambios={recargarClubs}
            onClose={() => setAdminOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <ClubProvider value={{ clubId, club, clubs, superAdmin }}>
      <div
        className={`app ${anchoCompleto ? 'app--ancho' : ''}`}
        style={anchoCompleto ? { maxWidth: `${anchoMax}px` } : undefined}
      >
        <Header
          club={club}
          clubs={clubs}
          onCambiarClub={cambiarClub}
          totals={totals}
          user={user}
          superAdmin={superAdmin}
          onSignOut={signOut}
          onOpenConfig={() => setConfigOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
        />

        {!isFirebaseConfigured && (
          <div className="banner banner--warn">
            Modo demo: Firebase no está configurado. Los datos se guardan solo en este
            navegador (localStorage). Completá <code>.env</code> para sincronizar.
          </div>
        )}
        {isEmulator && (
          <div className="banner banner--warn">
            Emulador local: estás trabajando sobre la base de prueba, no sobre producción.
          </div>
        )}
        {error && (
          <div className="banner banner--error">Error al leer/guardar la planilla: {error.message}</div>
        )}

        <DateToolbar
          dateKey={dateKey}
          onChange={setDateKey}
          totals={totals}
          onOpenResumen={() => setResumenOpen(true)}
          onOpenSaldos={() => setSaldosOpen(true)}
        />

        <main className={`layout ${anchoCompleto ? 'layout--ancho' : ''}`}>
          <section className="layout__courts">
            <CourtsBoard
              config={config}
              horarios={horarios}
              planilla={planilla}
              update={update}
              loading={loading}
              sugerencias={sugerencias}
              onCommitNombre={upsertNombre}
            />
          </section>
          {!anchoCompleto && (
            <aside className="layout__consumos">
              {paneles.cuentas}
              {paneles.consumos}
            </aside>
          )}
        </main>

        {anchoCompleto && !drawerOpen && (
          <SolapaPaneles onOpen={() => setDrawerOpen(true)} pendiente={totals.pendiente} />
        )}

        {anchoCompleto && drawerOpen && (
          <PanelesDrawer onClose={() => setDrawerOpen(false)} paneles={paneles} />
        )}

        {configOpen && (
          <ConfigModal
            config={config}
            club={club}
            onSave={saveConfig}
            onSaveClub={saveClub}
            onClose={() => setConfigOpen(false)}
            jugadores={jugadores}
            onSaveJugador={saveJugador}
            onDeleteJugador={deleteJugador}
          />
        )}

        {resumenOpen && (
          <ResumenMensualModal monthKey={dateKey.slice(0, 7)} onClose={() => setResumenOpen(false)} />
        )}

        {saldosOpen && (
          <SaldosModal
            jugadores={jugadores}
            sugerencias={sugerencias}
            onCommitNombre={upsertNombre}
            onClose={() => setSaldosOpen(false)}
          />
        )}

        {adminOpen && superAdmin && (
          <AdminClubesModal
            emailActual={user?.email}
            onCambios={recargarClubs}
            onClose={() => setAdminOpen(false)}
          />
        )}
      </div>
    </ClubProvider>
  )
}

// Lista de nombres para autocompletar: jugadores activos del directorio más los
// nombres que ya aparecen en la planilla del día (turnos, consumos, mostrador).
// Se dedupe sin distinguir mayúsculas y se ordena alfabéticamente.
function computeSugerencias(jugadores, planilla) {
  const map = new Map() // clave normalizada -> nombre a mostrar
  const add = (nombre) => {
    const n = (nombre || '').trim()
    if (n && !map.has(n.toLowerCase())) map.set(n.toLowerCase(), n)
  }
  for (const j of jugadores || []) {
    if (j.activo === false) continue
    add(j.nombre)
  }
  for (const lista of Object.values(planilla.turnos || {})) {
    for (const t of lista) add(t.jugador)
  }
  for (const c of planilla.consumos || []) add(c.jugador)
  for (const tab of planilla.mostrador || []) add(tab.nombre)
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
}

// El desglose por medio (contado/mercado/anotado) cuenta solo las líneas ya
// cobradas; lo no cobrado se acumula en `pendiente`. `total` es el facturado.
function computeTotals(planilla) {
  const acc = { contado: 0, mercado: 0, anotado: 0, pendiente: 0, total: 0 }
  const sumar = (monto, item) => {
    if (item.pagado) acc[item.pago] = (acc[item.pago] || 0) + monto
    else acc.pendiente += monto
    acc.total += monto
  }
  for (const lista of Object.values(planilla.turnos || {})) {
    for (const t of lista) sumar(Number(t.monto) || 0, t)
  }
  for (const c of planilla.consumos || []) {
    sumar((Number(c.precio) || 0) * (Number(c.cantidad) || 0), c)
  }
  for (const tab of planilla.mostrador || []) {
    for (const it of tab.items || []) {
      // El estado de pago vive en la cuenta de mostrador, no en cada ítem.
      sumar((Number(it.precio) || 0) * (Number(it.cantidad) || 0), tab)
    }
  }
  return acc
}
