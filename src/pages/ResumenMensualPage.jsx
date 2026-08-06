import { useEffect, useMemo, useState } from 'react'
import { loadMonth } from '../firebase/planillas'
import { loadFiadoPagos } from '../firebase/fiado'
import { loadComprasMes } from '../firebase/stock'
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
  const [compras, setCompras] = useState([])
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

  // Compras de mercadería del mes: lo que se gastó reponiendo, que no es lo mismo
  // que el costo de lo vendido (se puede comprar en un mes y vender en otro).
  useEffect(() => {
    let active = true
    setCompras([])
    loadComprasMes(clubId, mes)
      .then((c) => active && setCompras(c))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [clubId, mes])

  const gastoInsumos = useMemo(
    () => compras.reduce((s, c) => s + (Number(c.cantidad) || 0) * (Number(c.costo) || 0), 0),
    [compras],
  )

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
                <div className="resumen__card" style={{ '--pago-color': '#94a3b8' }}>
                  <span className="resumen__card-label">Sin cobrar</span>
                  <span className="resumen__card-value">{formatMoney(r.pendiente)}</span>
                </div>
              </div>

              {/* El detalle fino queda plegado: la pantalla abre con los totales. */}
              {(r.consumos.venta > 0 || gastoInsumos > 0) && (
                <Detalle
                  titulo="Consumos y mercadería"
                  total={
                    r.consumos.hayCosto ? `${formatMoney(r.consumos.ganancia)} de ganancia` : null
                  }
                >
                  <ul className="resumen__lineas">
                    <li className="resumen__linea">
                      <span>Vendido en consumos</span>
                      <span className="resumen__linea-monto">{formatMoney(r.consumos.venta)}</span>
                    </li>
                    {r.consumos.hayCosto && (
                      <>
                        <li className="resumen__linea">
                          <span>Costo de lo vendido</span>
                          <span className="resumen__linea-monto">
                            − {formatMoney(r.consumos.costo)}
                          </span>
                        </li>
                        <li className="resumen__linea resumen__linea--total">
                          <span>Ganancia</span>
                          <span className="resumen__linea-monto">
                            {formatMoney(r.consumos.ganancia)}
                          </span>
                        </li>
                      </>
                    )}
                    <li className="resumen__linea">
                      <span>Compras de mercadería del mes</span>
                      <span className="resumen__linea-monto">{formatMoney(gastoInsumos)}</span>
                    </li>
                  </ul>
                  <p className="cfg-hint">
                    Las compras son lo que se gastó reponiendo este mes; el costo de lo vendido es
                    lo que salió la mercadería que efectivamente se consumió, que puede haberse
                    comprado antes.
                    {!r.consumos.hayCosto &&
                      ' Todavía no hay compras cargadas para lo que se vendió, así que no se puede calcular la ganancia.'}
                    {r.consumos.hayCosto &&
                      r.consumos.sinCosto > 0 &&
                      ` ${formatMoney(r.consumos.sinCosto)} se vendieron sin costo cargado, así que la ganancia real es algo menor.`}
                  </p>
                </Detalle>
              )}

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
