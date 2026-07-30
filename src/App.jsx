import { useMemo, useState } from 'react'
import { isFirebaseConfigured, isEmulator } from './firebase/config'
import { actualizarClub } from './firebase/clubs'
import { useSesion } from './hooks/useSesion'
import { ClubProvider } from './hooks/useClub'
import { useConfig } from './hooks/useConfig'
import { useJugadores } from './hooks/useJugadores'
import { usePlanilla } from './hooks/usePlanilla'
import { useStock } from './hooks/useStock'
import { useRuta } from './hooks/useRuta'
import { todayKey } from './utils/helpers'
import { ejeHorarios } from './data/defaults'
import { productosAReponer } from './utils/stock'
import { lineasDePlanilla } from './utils/planilla'
import Header from './components/Header'
import DateToolbar from './components/DateToolbar'
import CourtsBoard from './components/CourtsBoard'
import ConsumosPanel from './components/ConsumosPanel'
import CuentasPanel from './components/CuentasPanel'
import PanelesDrawer, { SolapaPaneles } from './components/PanelesDrawer'
import Nav from './components/Nav'
import ConfigPage from './pages/ConfigPage'
import StockPage from './pages/StockPage'
import JugadoresPage from './pages/JugadoresPage'
import FinanzasPage from './pages/FinanzasPage'
import ClubesPage from './pages/ClubesPage'
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
  const { ruta, ir, bloquearSalida } = useRuta()

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
  const { stock, descontar, comprar, editar, deshacer, ajustar, setMinimo } = useStock(clubId)

  const totals = useMemo(() => computeTotals(planilla), [planilla])
  // Filas del tablero: la unión de las franjas de todas las canchas de ese día.
  const eje = useMemo(() => ejeHorarios(config, dateKey), [config, dateKey])
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
        stock={stock}
        onStock={descontar}
      />
    ),
  }

  // Con un solo producto para reponer ya se avisa en la pestaña de Stock.
  const stockBajo = useMemo(
    () => productosAReponer(stock, config.productos || []).length > 0,
    [stock, config.productos],
  )

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
        <ClubesPage emailActual={user?.email} onCambios={recargarClubs} />
        <div className="app__pie">
          <button className="btn" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
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
          onOpenClubes={() => ir('clubes')}
        />

        <Nav ruta={ruta} onIr={ir} stockBajo={stockBajo} />

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

        {ruta === 'planilla' && (
          <>
            <DateToolbar dateKey={dateKey} onChange={setDateKey} totals={totals} />

            <main className={`layout ${anchoCompleto ? 'layout--ancho' : ''}`}>
              <section className="layout__courts">
                <CourtsBoard
                  config={config}
                  eje={eje}
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
          </>
        )}

        {ruta === 'stock' && (
          <StockPage
            config={config}
            stock={stock}
            onGuardarProductos={(productos) => saveConfig({ ...config, productos })}
            onComprar={comprar}
            onEditarCompra={editar}
            onDeshacerCompra={deshacer}
            onAjustar={ajustar}
            onMinimo={setMinimo}
          />
        )}

        {ruta === 'jugadores' && (
          <JugadoresPage
            jugadores={jugadores}
            onSave={saveJugador}
            onDelete={deleteJugador}
          />
        )}

        {ruta === 'finanzas' && (
          <FinanzasPage
            monthKey={dateKey.slice(0, 7)}
            jugadores={jugadores}
            sugerencias={sugerencias}
            onCommitNombre={upsertNombre}
          />
        )}

        {ruta === 'config' && (
          <ConfigPage
            config={config}
            club={club}
            onSave={saveConfig}
            onSaveClub={saveClub}
            bloquearSalida={bloquearSalida}
            ir={ir}
          />
        )}

        {ruta === 'clubes' && superAdmin && (
          <ClubesPage emailActual={user?.email} onCambios={recargarClubs} />
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
  for (const l of lineasDePlanilla(planilla)) {
    if (l.pagado) acc[l.pago] = (acc[l.pago] || 0) + l.monto
    else acc.pendiente += l.monto
    acc.total += l.monto
  }
  return acc
}
