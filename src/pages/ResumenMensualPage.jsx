import { useEffect, useMemo, useState } from 'react'
import { loadMonth } from '../firebase/planillas'
import { loadFiadoPagos } from '../firebase/fiado'
import { resumenMensual } from '../utils/resumen'
import { PAGOS } from '../data/defaults'
import { formatMoney, formatMonth, formatDayShort, shiftMonth } from '../utils/helpers'
import { useClubId } from '../hooks/useClub'
import Detalle from '../components/Detalle'

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
              {/* Lo que efectivamente entró: ventas cobradas + fiados que pagaron. */}
              <div className="resumen__total">
                <span className="resumen__total-label">Entró en caja</span>
                <span className="resumen__total-value">{formatMoney(r.caja.total)}</span>
              </div>
              <div className="resumen__cards">
                <div className="resumen__card" style={{ '--pago-color': '#16a34a' }}>
                  <span className="resumen__card-label">Contado</span>
                  <span className="resumen__card-value">{formatMoney(r.caja.contado)}</span>
                </div>
                <div className="resumen__card" style={{ '--pago-color': '#2563eb' }}>
                  <span className="resumen__card-label">Mercado Pago</span>
                  <span className="resumen__card-value">{formatMoney(r.caja.mercado)}</span>
                </div>
                {r.caja.fiado > 0 && (
                  <div className="resumen__card" style={{ '--pago-color': '#7c3aed' }}>
                    <span className="resumen__card-label">De eso, cobros de fiado</span>
                    <span className="resumen__card-value">{formatMoney(r.caja.fiado)}</span>
                  </div>
                )}
              </div>

              {/* Lo vendido en el mes, se haya cobrado o no. */}
              <div className="resumen__sub">
                <h3 className="resumen__sub-titulo">Se facturó</h3>
                <span className="resumen__sub-total">{formatMoney(r.total)}</span>
              </div>
              <div className="resumen__cards">
                <div className="resumen__card" style={{ '--pago-color': '#16a34a' }}>
                  <span className="resumen__card-label">Cobrado en el momento</span>
                  <span className="resumen__card-value">{formatMoney(r.cobrado)}</span>
                </div>
                <div className="resumen__card" style={{ '--pago-color': '#f59e0b' }}>
                  <span className="resumen__card-label">Quedó anotado (fiado)</span>
                  <span className="resumen__card-value">{formatMoney(r.anotado)}</span>
                </div>
                {r.pendiente > 0 && (
                  <div className="resumen__card" style={{ '--pago-color': '#94a3b8' }}>
                    <span className="resumen__card-label">Sin cobrar todavía</span>
                    <span className="resumen__card-value">{formatMoney(r.pendiente)}</span>
                  </div>
                )}
              </div>
              {r.caja.fiado > 0 && (
                <p className="resumen__nota">
                  Los {formatMoney(r.caja.fiado)} de fiados cobrados no figuran acá abajo: se
                  facturaron el día que se anotaron, que puede haber sido en otro mes.
                </p>
              )}

              {/* Consumos: cuánto se vendió y, si hay costos cargados, la ganancia. */}
              {r.consumos.venta > 0 && (
                <>
                  <div className="resumen__sub">
                    <h3 className="resumen__sub-titulo">Consumos del mes</h3>
                    {r.consumos.hayCosto && (
                      <span className="resumen__sub-total">
                        {formatMoney(r.consumos.ganancia)} de ganancia
                      </span>
                    )}
                  </div>
                  <div className="resumen__cards">
                    <div className="resumen__card" style={{ '--pago-color': '#16a34a' }}>
                      <span className="resumen__card-label">Vendido</span>
                      <span className="resumen__card-value">{formatMoney(r.consumos.venta)}</span>
                    </div>
                    {r.consumos.hayCosto && (
                      <>
                        <div className="resumen__card" style={{ '--pago-color': '#dc2626' }}>
                          <span className="resumen__card-label">Costó</span>
                          <span className="resumen__card-value">{formatMoney(r.consumos.costo)}</span>
                        </div>
                        <div className="resumen__card" style={{ '--pago-color': '#2563eb' }}>
                          <span className="resumen__card-label">Ganancia</span>
                          <span className="resumen__card-value">
                            {formatMoney(r.consumos.ganancia)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {!r.consumos.hayCosto ? (
                    <p className="resumen__nota">
                      Todavía no hay compras cargadas en Stock, así que no se puede calcular
                      cuánto costó esta mercadería ni la ganancia.
                    </p>
                  ) : (
                    r.consumos.sinCosto > 0 && (
                      <p className="resumen__nota">
                        {formatMoney(r.consumos.sinCosto)} se vendieron sin costo cargado, así que
                        la ganancia real es algo menor.
                      </p>
                    )
                  )}
                </>
              )}

              {/* Detalles: plegados, para que la pantalla arranque con los números. */}
              <Detalle titulo="Facturado por día" total={formatMoney(r.total)}>
                <table className="resumen__tabla">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Contado</th>
                      <th>Mercado</th>
                      <th>Anotado</th>
                      {/* Sin esta columna las filas no cerraban: el total incluye
                          lo que todavía no se cobró. */}
                      <th>Sin cobrar</th>
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
                        <td>{d.pendiente ? formatMoney(d.pendiente) : '—'}</td>
                        <td className="resumen__td-total">{formatMoney(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Detalle>

              <Detalle titulo="Qué quedó anotado" total={formatMoney(r.anotado)}>
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
              </Detalle>

              {r.fiadoCobradoDetalle.length > 0 && (
                <Detalle
                  titulo="Fiados que pagaron"
                  total={formatMoney(r.fiadoCobrado.total)}
                >
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
                </Detalle>
              )}
            </>
          )}
    </>
  )
}
