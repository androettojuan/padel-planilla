import { useMemo, useState } from 'react'
import { PAGOS, PAGOS_BY_ID } from '../data/defaults'
import { formatMoney } from '../utils/helpers'
import { buildCuentas, aplicarPago, SIN_ASIGNAR_LABEL } from '../utils/cuentas'

export default function CuentasPanel({ config, planilla, update }) {
  const cuentas = useMemo(() => buildCuentas(planilla, config), [planilla, config])
  // Nombre de la cuenta cuyo selector de medio de pago está abierto.
  const [cobrando, setCobrando] = useState(null)
  // Mostrar el detalle de las cuentas ya cobradas (colapsado por defecto).
  const [verPagadas, setVerPagadas] = useState(false)

  const confirmar = (nombre, medio) => {
    update((prev) => aplicarPago(prev, nombre, medio, true))
    setCobrando(null)
  }
  const revertir = (nombre) => update((prev) => aplicarPago(prev, nombre, null, false))

  const pendientes = cuentas.filter((c) => !c.pagado)
  const pagadas = cuentas.filter((c) => c.pagado)
  const totalPendiente = pendientes.reduce((s, c) => s + c.total, 0)
  const totalPagado = pagadas.reduce((s, c) => s + c.total, 0)

  return (
    <div className="cuentas">
      <div className="section-head">
        <h2 className="section-title">Cuentas</h2>
        {pendientes.length > 0 && (
          <span className="cuentas__pend">{formatMoney(totalPendiente)} pendiente</span>
        )}
      </div>

      <div className="cuentas__card">
        {pendientes.length === 0 ? (
          <p className="consumos__empty muted">
            {pagadas.length > 0
              ? 'No hay cuentas pendientes.'
              : 'Cuando cargues turnos o consumos aparecen acá.'}
          </p>
        ) : (
          <ul className="cuentas__list">
            {pendientes.map((c) => {
              const label = c.nombre || SIN_ASIGNAR_LABEL
              return (
                <li className="cuenta" key={label}>
                  <div className="cuenta__head">
                    <span className="cuenta__name">{label}</span>
                    <span className="cuenta__total">{formatMoney(c.total)}</span>
                  </div>

                  <div className="cuenta__detail">
                    {c.totalTurnos > 0 && (
                      <span className="cuenta__line">Turno {formatMoney(c.totalTurnos)}</span>
                    )}
                    {c.totalConsumos > 0 && (
                      <span className="cuenta__line">Consumos {formatMoney(c.totalConsumos)}</span>
                    )}
                  </div>

                  {cobrando === label ? (
                    <div className="cuenta__medios">
                      {PAGOS.map((p) => (
                        <button
                          key={p.id}
                          className="medio-btn"
                          style={{ '--pago-color': p.color }}
                          onClick={() => confirmar(c.nombre, p.id)}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button className="btn btn--ghost-sm" onClick={() => setCobrando(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn--primary cuenta__cobrar"
                      onClick={() => setCobrando(label)}
                    >
                      Confirmar pago
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {pagadas.length > 0 && (
          <div className="cuentas__pagadas">
            <button
              className="cuentas__toggle"
              onClick={() => setVerPagadas((v) => !v)}
            >
              <span>
                {verPagadas ? '▾' : '▸'} Pagadas ({pagadas.length})
              </span>
              <span className="cuentas__toggle-total">{formatMoney(totalPagado)}</span>
            </button>

            {verPagadas && (
              <ul className="cuentas__list cuentas__list--pagadas">
                {pagadas.map((c) => {
                  const label = c.nombre || SIN_ASIGNAR_LABEL
                  const medio = c.medio ? PAGOS_BY_ID[c.medio] : null
                  return (
                    <li className="cuenta cuenta--pagada" key={label}>
                      <div className="cuenta__head">
                        <span className="cuenta__name">{label}</span>
                        <span className="cuenta__total">{formatMoney(c.total)}</span>
                      </div>
                      <div className="cuenta__paid">
                        <span className="pago pago--sm" style={{ '--pago-color': medio?.color }}>
                          ✓ {medio?.label || 'Pagado'}
                        </span>
                        <button className="btn btn--ghost-sm" onClick={() => revertir(c.nombre)}>
                          Revertir
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
