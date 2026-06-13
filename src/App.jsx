import { useEffect, useMemo, useState } from 'react'
import { ensureAuth, isFirebaseConfigured } from './firebase/config'
import { useConfig } from './hooks/useConfig'
import { usePlanilla } from './hooks/usePlanilla'
import { todayKey } from './utils/helpers'
import Header from './components/Header'
import DateToolbar from './components/DateToolbar'
import CourtsBoard from './components/CourtsBoard'
import ConsumosPanel from './components/ConsumosPanel'

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey())
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured)
  const [authError, setAuthError] = useState(null)

  const { config } = useConfig()
  const { planilla, update, loading, error } = usePlanilla(dateKey)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    ensureAuth()
      .then(() => setAuthReady(true))
      .catch((err) => setAuthError(err))
  }, [])

  const totals = useMemo(() => computeTotals(planilla), [planilla])

  return (
    <div className="app">
      <Header club={config.club} totals={totals} />

      {!isFirebaseConfigured && (
        <div className="banner banner--warn">
          Modo demo: Firebase no está configurado. Los datos se guardan solo en este
          navegador (localStorage). Completá <code>.env</code> para sincronizar.
        </div>
      )}
      {authError && (
        <div className="banner banner--error">No se pudo iniciar sesión: {authError.message}</div>
      )}
      {error && (
        <div className="banner banner--error">Error al leer/guardar la planilla: {error.message}</div>
      )}

      <DateToolbar dateKey={dateKey} onChange={setDateKey} totals={totals} />

      {authReady ? (
        <main className="layout">
          <section className="layout__courts">
            <CourtsBoard config={config} planilla={planilla} update={update} loading={loading} />
          </section>
          <aside className="layout__consumos">
            <ConsumosPanel config={config} planilla={planilla} update={update} />
          </aside>
        </main>
      ) : (
        <div className="loading">Conectando…</div>
      )}
    </div>
  )
}

function computeTotals(planilla) {
  const acc = { contado: 0, mercado: 0, anotado: 0, total: 0 }
  for (const lista of Object.values(planilla.turnos || {})) {
    for (const t of lista) {
      const monto = Number(t.monto) || 0
      acc[t.pago] = (acc[t.pago] || 0) + monto
      acc.total += monto
    }
  }
  for (const c of planilla.consumos || []) {
    const sub = (Number(c.precio) || 0) * (Number(c.cantidad) || 0)
    acc[c.pago] = (acc[c.pago] || 0) + sub
    acc.total += sub
  }
  return acc
}
