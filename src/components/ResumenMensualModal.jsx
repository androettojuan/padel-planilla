import { useEffect, useMemo, useState } from 'react'
import { loadMonth } from '../firebase/planillas'
import { resumenMensual } from '../utils/resumen'
import { PAGOS } from '../data/defaults'
import { formatMoney, formatMonth, formatDayShort, shiftMonth } from '../utils/helpers'

export default function ResumenMensualModal({ monthKey, onClose }) {
  const [mes, setMes] = useState(monthKey)
  const [planillas, setPlanillas] = useState(null) // null = cargando
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setPlanillas(null)
    setError(null)
    loadMonth(mes)
      .then((p) => active && setPlanillas(p))
      .catch((e) => active && setError(e))
    return () => {
      active = false
    }
  }, [mes])

  const r = useMemo(() => resumenMensual(planillas || []), [planillas])
  const sinDatos = planillas && r.total === 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Resumen mensual</h2>
          <button className="player__del" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="resumen__nav">
            <button className="btn btn--ghost" onClick={() => setMes(shiftMonth(mes, -1))} aria-label="Mes anterior">
              ‹
            </button>
            <span className="resumen__mes">{formatMonth(mes)}</span>
            <button className="btn btn--ghost" onClick={() => setMes(shiftMonth(mes, 1))} aria-label="Mes siguiente">
              ›
            </button>
          </div>

          {error ? (
            <p className="banner banner--error">No se pudo leer el mes: {error.message}</p>
          ) : !planillas ? (
            <p className="muted resumen__estado">Cargando…</p>
          ) : sinDatos ? (
            <p className="muted resumen__estado">No hay movimientos en este mes.</p>
          ) : (
            <>
              <div className="resumen__total">
                <span className="resumen__total-label">Total facturado</span>
                <span className="resumen__total-value">{formatMoney(r.total)}</span>
              </div>

              <div className="resumen__cards">
                {PAGOS.map((p) => (
                  <div className="resumen__card" key={p.id} style={{ '--pago-color': p.color }}>
                    <span className="resumen__card-label">{p.label}</span>
                    <span className="resumen__card-value">{formatMoney(r[p.id])}</span>
                  </div>
                ))}
                {r.pendiente > 0 && (
                  <div className="resumen__card" style={{ '--pago-color': '#94a3b8' }}>
                    <span className="resumen__card-label">Pendiente (sin cobrar)</span>
                    <span className="resumen__card-value">{formatMoney(r.pendiente)}</span>
                  </div>
                )}
              </div>

              {/* Desglose por día */}
              <section className="cfg-section">
                <h3 className="cfg-section__title">Por día</h3>
                <table className="resumen__tabla">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Contado</th>
                      <th>Mercado</th>
                      <th>Anotado</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.porDia.map((d) => (
                      <tr key={d.dateKey}>
                        <td className="resumen__dia">{formatDayShort(d.dateKey)}</td>
                        <td>{d.contado ? formatMoney(d.contado) : '—'}</td>
                        <td>{d.mercado ? formatMoney(d.mercado) : '—'}</td>
                        <td>{d.anotado ? formatMoney(d.anotado) : '—'}</td>
                        <td className="resumen__td-total">{formatMoney(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Detalle de lo anotado */}
              <section className="cfg-section">
                <div className="cfg-section__head">
                  <h3 className="cfg-section__title">Detalle de lo anotado</h3>
                  <span className="resumen__anotado-total">{formatMoney(r.anotado)}</span>
                </div>
                {r.anotadoDetalle.length === 0 ? (
                  <p className="muted">No hay nada anotado este mes.</p>
                ) : (
                  <ul className="resumen__anotado">
                    {r.anotadoDetalle.map((a, i) => (
                      <li className="resumen__anotado-row" key={`${a.dateKey}-${i}`}>
                        <span className="resumen__anotado-fecha">{formatDayShort(a.dateKey)}</span>
                        <span className="resumen__anotado-nombre">{a.nombre}</span>
                        <span className="resumen__anotado-concepto">{a.concepto}</span>
                        <span className="resumen__anotado-monto">{formatMoney(a.monto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
