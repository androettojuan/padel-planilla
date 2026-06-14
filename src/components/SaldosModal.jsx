import { useEffect, useMemo, useState } from 'react'
import { loadAllPlanillas } from '../firebase/planillas'
import {
  loadFiadoPagos,
  saveFiadoPago,
  deleteFiadoPago,
  loadFiadoCargos,
  saveFiadoCargo,
  deleteFiadoCargo,
} from '../firebase/fiado'
import { buildSaldos } from '../utils/saldos'
import { PAGOS } from '../data/defaults'
import { uid, formatMoney, formatDateNumeric, todayKey, normalizeNombre } from '../utils/helpers'
import NombreInput from './NombreInput'

// Medios con los que se puede saldar un fiado (todos menos "Anotado", que es
// justamente lo que genera la deuda).
const MEDIOS_PAGO = PAGOS.filter((p) => p.id !== 'anotado')

export default function SaldosModal({ jugadores = [], sugerencias = [], onCommitNombre, onClose }) {
  const [planillas, setPlanillas] = useState(null) // null = cargando
  const [fiadoPagos, setFiadoPagos] = useState([])
  const [cargos, setCargos] = useState([]) // deudas cargadas a mano
  const [error, setError] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState(null) // nombreKey con detalle abierto
  const [cobrando, setCobrando] = useState(null) // nombreKey registrando pago
  const [monto, setMonto] = useState('')
  const [verSaldados, setVerSaldados] = useState(false)
  const [confirmCargo, setConfirmCargo] = useState(null) // id del cargo a borrar

  // Formulario para cargar una deuda a mano.
  const [agregando, setAgregando] = useState(false)
  const [cgNombre, setCgNombre] = useState('')
  const [cgConcepto, setCgConcepto] = useState('')
  const [cgMonto, setCgMonto] = useState('')
  const [cgFecha, setCgFecha] = useState(todayKey())

  useEffect(() => {
    let active = true
    Promise.all([loadAllPlanillas(), loadFiadoPagos(), loadFiadoCargos()])
      .then(([p, f, c]) => {
        if (!active) return
        setPlanillas(p)
        setFiadoPagos(f)
        setCargos(c)
      })
      .catch((e) => active && setError(e))
    return () => {
      active = false
    }
  }, [])

  const { saldos, totalDeuda } = useMemo(
    () => buildSaldos(planillas || [], fiadoPagos, jugadores, cargos),
    [planillas, fiadoPagos, jugadores, cargos],
  )

  const q = normalizeNombre(busqueda)
  const matchNombre = (nombre) => !q || normalizeNombre(nombre).includes(q)

  const deudores = saldos.filter((s) => s.saldo > 0 && matchNombre(s.nombre))
  const saldados = saldos.filter((s) => s.saldo <= 0 && matchNombre(s.nombre))

  const abrirCobro = (s) => {
    setExpandido(s.nombreKey)
    setCobrando(s.nombreKey)
    setMonto(String(s.saldo > 0 ? s.saldo : ''))
  }

  const registrarPago = async (s, medio) => {
    const valor = Number(monto)
    if (!(valor > 0)) return
    const pago = {
      id: uid(),
      nombre: s.nombre,
      nombreKey: s.nombreKey,
      monto: valor,
      medio,
      fecha: todayKey(),
      creado: Date.now(),
    }
    setFiadoPagos((prev) => [...prev, pago]) // optimista
    setCobrando(null)
    setMonto('')
    try {
      await saveFiadoPago(pago)
    } catch (e) {
      setFiadoPagos((prev) => prev.filter((p) => p.id !== pago.id))
      setError(e)
    }
  }

  const revertirPago = async (id) => {
    const prev = fiadoPagos
    setFiadoPagos((l) => l.filter((p) => p.id !== id))
    try {
      await deleteFiadoPago(id)
    } catch (e) {
      setFiadoPagos(prev)
      setError(e)
    }
  }

  const agregarCargo = async () => {
    const nombre = cgNombre.trim()
    const valor = Number(cgMonto)
    if (!nombre || !(valor > 0)) return
    const cargo = {
      id: uid(),
      nombre,
      nombreKey: normalizeNombre(nombre),
      concepto: cgConcepto.trim() || 'Fiado',
      monto: valor,
      fecha: cgFecha || todayKey(),
      creado: Date.now(),
    }
    setCargos((prev) => [...prev, cargo]) // optimista
    onCommitNombre?.(nombre) // alta en el directorio si es nuevo
    // Limpiamos lo justo para seguir cargando en serie (mantenemos la fecha).
    setCgNombre('')
    setCgConcepto('')
    setCgMonto('')
    try {
      await saveFiadoCargo(cargo)
    } catch (e) {
      setCargos((prev) => prev.filter((c) => c.id !== cargo.id))
      setError(e)
    }
  }

  const borrarCargo = async (id) => {
    const prev = cargos
    setCargos((l) => l.filter((c) => c.id !== id))
    try {
      await deleteFiadoCargo(id)
    } catch (e) {
      setCargos(prev)
      setError(e)
    }
  }

  const medioLabel = (id) => PAGOS.find((p) => p.id === id)?.label || id

  const renderItem = (s) => {
    const abierto = expandido === s.nombreKey
    const favor = s.saldo < 0
    return (
      <li className="saldo-item" key={s.nombreKey}>
        <button
          className="saldo-item__main"
          onClick={() => setExpandido(abierto ? null : s.nombreKey)}
        >
          <span className="saldo-item__chev">{abierto ? '▾' : '▸'}</span>
          <span className="saldo-item__name">{s.nombre}</span>
          <span className={`saldo-item__amount ${favor ? 'is-favor' : ''}`}>
            {favor ? `${formatMoney(-s.saldo)} a favor` : formatMoney(s.saldo)}
          </span>
        </button>

        {abierto && (
          <div className="saldo-item__body">
            <div className="saldo__detalle">
              {s.cargos.map((c, i) => (
                <div className="saldo__mov" key={`c-${i}`}>
                  <span className="saldo__mov-fecha">{formatDateNumeric(c.dateKey)}</span>
                  <span className="saldo__mov-concepto">
                    {c.concepto}
                    {c.manual && <span className="saldo__tag"> a mano</span>}
                  </span>
                  <span className="saldo__mov-monto">{formatMoney(c.monto)}</span>
                  {c.manual && c.id ? (
                    confirmCargo === c.id ? (
                      <div className="confirm-inline">
                        <button
                          className="confirm-inline__yes"
                          onClick={() => {
                            borrarCargo(c.id)
                            setConfirmCargo(null)
                          }}
                          aria-label="Confirmar borrado"
                          title="Borrar"
                        >
                          ✓
                        </button>
                        <button
                          className="confirm-inline__no"
                          onClick={() => setConfirmCargo(null)}
                          aria-label="Cancelar"
                          title="Cancelar"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        className="player__del"
                        onClick={() => setConfirmCargo(c.id)}
                        aria-label="Borrar gasto"
                      >
                        ×
                      </button>
                    )
                  ) : (
                    <span className="player__del player__del--ghost" aria-hidden="true" />
                  )}
                </div>
              ))}
              {s.pagos.map((p) => (
                <div className="saldo__mov saldo__mov--pago" key={`p-${p.id}`}>
                  <span className="saldo__mov-fecha">{formatDateNumeric(p.fecha)}</span>
                  <span className="saldo__mov-concepto">Pago · {medioLabel(p.medio)}</span>
                  <span className="saldo__mov-monto">−{formatMoney(p.monto)}</span>
                  <button
                    className="player__del"
                    onClick={() => revertirPago(p.id)}
                    aria-label="Revertir pago"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {cobrando === s.nombreKey ? (
              <div className="saldo__cobro">
                <input
                  className="cfg-input"
                  inputMode="numeric"
                  placeholder="$ a pagar"
                  value={monto}
                  autoFocus
                  onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ''))}
                />
                <div className="cuenta__medios">
                  {MEDIOS_PAGO.map((p) => (
                    <button
                      key={p.id}
                      className="medio-btn"
                      style={{ '--pago-color': p.color }}
                      onClick={() => registrarPago(s, p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button className="btn btn--ghost-sm" onClick={() => setCobrando(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              s.saldo > 0 && (
                <button className="btn btn--primary saldo__pagar" onClick={() => abrirCobro(s)}>
                  Registrar pago
                </button>
              )
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Saldos / Fiados</h2>
          <button className="player__del" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal__body">
          {error ? (
            <p className="banner banner--error">No se pudo cargar: {error.message}</p>
          ) : !planillas ? (
            <p className="muted resumen__estado">Cargando…</p>
          ) : (
            <>
              <div className="resumen__total">
                <span className="resumen__total-label">Deuda total</span>
                <span className="resumen__total-value">{formatMoney(totalDeuda)}</span>
              </div>

              <input
                className="cfg-input saldos__search"
                placeholder="Buscar jugador…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />

              {agregando ? (
                <div className="saldo-form">
                  <div className="saldo-form__head">
                    <strong>Cargar gasto a mano</strong>
                    <button className="btn btn--ghost-sm" onClick={() => setAgregando(false)}>
                      Listo
                    </button>
                  </div>
                  <NombreInput
                    className="cfg-input"
                    placeholder="Nombre"
                    value={cgNombre}
                    sugerencias={sugerencias}
                    onChange={setCgNombre}
                    onCommit={onCommitNombre}
                  />
                  <input
                    className="cfg-input"
                    placeholder="Concepto (turno, consumo…)"
                    value={cgConcepto}
                    onChange={(e) => setCgConcepto(e.target.value)}
                  />
                  <div className="saldo-form__row">
                    <input
                      className="cfg-input"
                      inputMode="numeric"
                      placeholder="$ monto"
                      value={cgMonto}
                      onChange={(e) => setCgMonto(e.target.value.replace(/[^\d]/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && agregarCargo()}
                    />
                    <input
                      type="date"
                      className="cfg-input"
                      value={cgFecha}
                      onChange={(e) => setCgFecha(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn--primary"
                    onClick={agregarCargo}
                    disabled={!cgNombre.trim() || !(Number(cgMonto) > 0)}
                  >
                    Agregar gasto
                  </button>
                </div>
              ) : (
                <button className="btn btn--add saldos__add" onClick={() => setAgregando(true)}>
                  + Cargar gasto a mano
                </button>
              )}

              <section className="cfg-section">
                <h3 className="cfg-section__title">Deben ({deudores.length})</h3>
                {deudores.length === 0 ? (
                  <p className="muted">{q ? 'Sin resultados.' : 'Nadie debe fiado. 🎉'}</p>
                ) : (
                  <ul className="saldo-list">{deudores.map(renderItem)}</ul>
                )}
              </section>

              {saldados.length > 0 && (
                <div className="cuentas__pagadas">
                  <button className="cuentas__toggle" onClick={() => setVerSaldados((v) => !v)}>
                    <span>
                      {verSaldados ? '▾' : '▸'} Saldados ({saldados.length})
                    </span>
                  </button>
                  {verSaldados && <ul className="saldo-list">{saldados.map(renderItem)}</ul>}
                </div>
              )}
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
