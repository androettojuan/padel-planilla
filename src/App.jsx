import { useMemo, useState } from 'react'
import { isFirebaseConfigured } from './firebase/config'
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'
import { usePlanilla } from './hooks/usePlanilla'
import { todayKey } from './utils/helpers'
import { horariosForDate, DEFAULT_CONFIG } from './data/defaults'
import Header from './components/Header'
import DateToolbar from './components/DateToolbar'
import CourtsBoard from './components/CourtsBoard'
import ConsumosPanel from './components/ConsumosPanel'
import CuentasPanel from './components/CuentasPanel'
import MostradorPanel from './components/MostradorPanel'
import ConfigModal from './components/ConfigModal'
import ResumenMensualModal from './components/ResumenMensualModal'
import LoginScreen from './components/LoginScreen'

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey())
  const [configOpen, setConfigOpen] = useState(false)
  const [resumenOpen, setResumenOpen] = useState(false)

  const { user, authorized, loading: authLoading, error: authError, signIn, signOut } = useAuth()

  const { config, saveConfig } = useConfig(authorized)
  const { planilla, update, loading, error } = usePlanilla(dateKey, authorized)

  const totals = useMemo(() => computeTotals(planilla), [planilla])
  const horarios = useMemo(() => horariosForDate(config, dateKey), [config, dateKey])

  // Antes de autorizar: pantalla de carga / login / no autorizado.
  if (authLoading) {
    return <div className="loading loading--full">Conectando…</div>
  }
  if (!authorized) {
    return (
      <LoginScreen
        user={user}
        onSignIn={signIn}
        onSignOut={signOut}
        error={authError}
        club={DEFAULT_CONFIG.club}
      />
    )
  }

  return (
    <div className="app">
      <Header
        club={config.club}
        totals={totals}
        user={user}
        onSignOut={signOut}
        onOpenConfig={() => setConfigOpen(true)}
      />

      {!isFirebaseConfigured && (
        <div className="banner banner--warn">
          Modo demo: Firebase no está configurado. Los datos se guardan solo en este
          navegador (localStorage). Completá <code>.env</code> para sincronizar.
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
      />

      <main className="layout">
        <section className="layout__courts">
          <CourtsBoard config={config} horarios={horarios} planilla={planilla} update={update} loading={loading} />
        </section>
        <aside className="layout__consumos">
          <CuentasPanel config={config} planilla={planilla} update={update} />
          <ConsumosPanel config={config} planilla={planilla} update={update} />
          <MostradorPanel config={config} planilla={planilla} update={update} />
        </aside>
      </main>

      {configOpen && (
        <ConfigModal config={config} onSave={saveConfig} onClose={() => setConfigOpen(false)} />
      )}

      {resumenOpen && (
        <ResumenMensualModal monthKey={dateKey.slice(0, 7)} onClose={() => setResumenOpen(false)} />
      )}
    </div>
  )
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
