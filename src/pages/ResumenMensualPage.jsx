import { useEffect, useMemo, useState } from 'react'
import { loadMonth } from '../firebase/planillas'
import { loadFiadoPagos } from '../firebase/fiado'
import { resumenMensual } from '../utils/resumen'
import { PAGOS } from '../data/defaults'
import { formatMoney, formatMonth, formatDayShort, shiftMonth } from '../utils/helpers'
import { useClubId } from '../hooks/useClub'

const medioLabel = (id) => PAGOS.find((p) => p.id === id)?.label || id

export default function ResumenMensualPage({ monthKey }) {
  const clubId = useClubId()
  const [mes, setMes] = useState(monthKey)
  const [planillas, setPlanillas] = useState(null) // null = cargando
  const [fiadoPagos, setFiadoPagos] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setPlanillas(null)
    setError(null)
    loadMonth(clubId, mes)
      .then((p) => active && setPlanillas(p))
      .catch((e) => active && setError(e))
    return () => {
      active = false
    }
  }, [clubId, mes])

  // Los pagos de fiado se cargan una vez (todos) y se filtran por mes de pago.
  useEffect(() => {
    let active = true
    loadFiadoPagos(clubId)
      .then((p) => active && setFiadoPagos(p))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [clubId])

  const pagosMes = useMemo(
    () => fiadoPagos.filter((p) => (p.fecha || '').slice(0, 7) === mes),
    [fiadoPagos, mes],
  )
  const r = useMemo(() => resumenMensual(planillas || [], pagosMes), [planillas, pagosMes])
  const sinDatos = planillas && r.total === 0

  return (
    <>
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

              {r.fiadoCobrado.total > 0 && (
                <p className="resumen__nota">
                  💵 Este mes entraron <strong>{formatMoney(r.fiadoCobrado.total)}</strong> en pagos
                  de fiados
                  {r.fiadoCobrado.contado > 0 && ` · Contado ${formatMoney(r.fiadoCobrado.contado)}`}
                  {r.fiadoCobrado.mercado > 0 && ` · Mercado ${formatMoney(r.fiadoCobrado.mercado)}`}
                  . Ya están sumados en Contado/Mercado y restados de Anotado.
                  {r.anotado < 0 &&
                    ' El Anotado quedó en negativo porque este mes se cobró más fiado viejo del que se anotó nuevo.'}
                </p>
              )}

              {/* Ganancia de los consumos: lo vendido menos lo que costó */}
              {r.consumos.venta > 0 && (
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <h3 className="cfg-section__title">Consumos del mes</h3>
                    <span className="resumen__anotado-total">
                      {formatMoney(r.consumos.ganancia)} de ganancia
                    </span>
                  </div>
                  <div className="resumen__cards">
                    <div className="resumen__card" style={{ '--pago-color': '#16a34a' }}>
                      <span className="resumen__card-label">Vendido</span>
                      <span className="resumen__card-value">{formatMoney(r.consumos.venta)}</span>
                    </div>
                    <div className="resumen__card" style={{ '--pago-color': '#dc2626' }}>
                      <span className="resumen__card-label">Costo de la mercadería</span>
                      <span className="resumen__card-value">{formatMoney(r.consumos.costo)}</span>
                    </div>
                    <div className="resumen__card" style={{ '--pago-color': '#2563eb' }}>
                      <span className="resumen__card-label">Ganancia</span>
                      <span className="resumen__card-value">{formatMoney(r.consumos.ganancia)}</span>
                    </div>
                  </div>
                  {r.consumos.sinCosto > 0 && (
                    <p className="cfg-hint">
                      {formatMoney(r.consumos.sinCosto)} de consumos no tienen costo cargado (se
                      vendieron antes de llevar el stock, o de un producto sin control), así que la
                      ganancia real es menor.
                    </p>
                  )}
                </section>
              )}

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

              {/* Cobros de fiado del mes (plata que entró por pagos de fiados) */}
              {r.fiadoCobradoDetalle.length > 0 && (
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <h3 className="cfg-section__title">Cobros de fiado</h3>
                    <span className="resumen__anotado-total">
                      {formatMoney(r.fiadoCobrado.total)}
                    </span>
                  </div>
                  <ul className="resumen__anotado">
                    {r.fiadoCobradoDetalle.map((a, i) => (
                      <li className="resumen__anotado-row" key={`${a.dateKey}-${i}`}>
                        <span className="resumen__anotado-fecha">{formatDayShort(a.dateKey)}</span>
                        <span className="resumen__anotado-nombre">{a.nombre}</span>
                        <span className="resumen__anotado-concepto">{medioLabel(a.medio)}</span>
                        <span className="resumen__anotado-monto">{formatMoney(a.monto)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
    </>
  )
}
