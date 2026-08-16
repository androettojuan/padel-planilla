import { useEffect, useMemo, useState } from 'react'
import { useClubId } from '../hooks/useClub'
import { useGastos } from '../hooks/useGastos'
import {
  loadPagosMes,
  pagarGasto,
  editarPagoGasto,
  borrarPagoGasto,
} from '../firebase/gastos'
import { gastosDelMes } from '../utils/gastos'
import {
  formatMoney,
  formatMonth,
  formatDateNumeric,
  shiftMonth,
  soloDigitos,
  todayKey,
  uid,
} from '../utils/helpers'
import BotonBorrar from '../components/BotonBorrar'

/**
 * Los gastos fijos del club (alquiler, luz, sueldos) y qué se pagó de ellos en
 * cada mes.
 *
 * La lista de gastos se carga una sola vez con un monto de referencia —lo que
 * suele salir— y todos los meses aparece completa, para ir marcando lo que se va
 * pagando. El monto real se carga al marcar el pago, porque la luz no sale lo
 * mismo en junio que en enero; la referencia queda como estaba.
 *
 * Como en Stock, la lista se mira bloqueada: agregar, renombrar, cambiar la
 * referencia o quitar un gasto pide entrar en "✎ Editar". Marcar un pago, en
 * cambio, está siempre a mano: es la operación de todos los meses.
 */
export default function GastosPage({ monthKey }) {
  const clubId = useClubId()
  const { gastos, saveGasto, deleteGasto } = useGastos(clubId)
  const [mes, setMes] = useState(monthKey)
  const [pagos, setPagos] = useState(null) // null = cargando
  const [modoEdicion, setModoEdicion] = useState(false)
  const [pagando, setPagando] = useState(null) // id del gasto con el form abierto
  const [nuevo, setNuevo] = useState(null) // gasto que se está cargando
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setPagos(null)
    // Al cambiar de mes se cierra el pago que estuviera abierto: ese formulario
    // era del mes anterior.
    setPagando(null)
    loadPagosMes(clubId, mes)
      .then((p) => active && setPagos(p))
      .catch((e) => active && setError(e))
    return () => {
      active = false
    }
  }, [clubId, mes])

  const { filas, pagado, pendiente, total } = useMemo(
    () => gastosDelMes(gastos, pagos || []),
    [gastos, pagos],
  )

  // Un gasto se paga cuando llega la factura: si se está mirando un mes viejo, la
  // fecha que se propone es la del mes que se mira, no la de hoy.
  const fechaSugerida = todayKey().startsWith(mes) ? todayKey() : `${mes}-01`

  // Los pagos se actualizan en memoria: la operación ya sabe con qué quedó, así
  // que volver a pedir el mes por red sería una lectura al pedo.
  const pagar = async (fila, monto, fecha) => {
    setError(null)
    try {
      const pago = await pagarGasto(clubId, {
        gastoId: fila.id,
        nombre: fila.nombre,
        monto,
        mes,
        fecha,
      })
      setPagando(null)
      if (pago) setPagos((prev) => [...(prev || []), pago])
    } catch (err) {
      setError(err)
    }
  }

  const corregirPago = async (fila, monto, fecha) => {
    setError(null)
    try {
      await editarPagoGasto(clubId, fila.pago.id, { monto, fecha })
      setPagando(null)
      setPagos((prev) => prev.map((p) => (p.id === fila.pago.id ? { ...p, monto, fecha } : p)))
    } catch (err) {
      setError(err)
    }
  }

  const deshacerPago = async (fila) => {
    setError(null)
    try {
      await borrarPagoGasto(clubId, fila.pago.id)
      setPagando(null)
      setPagos((prev) => prev.filter((p) => p.id !== fila.pago.id))
    } catch (err) {
      setError(err)
    }
  }

  const guardarNuevo = () => {
    const nombre = (nuevo?.nombre || '').trim()
    if (!nombre) return
    saveGasto({
      id: nuevo.id,
      nombre,
      monto: Number(nuevo.monto) || 0,
      activo: true,
      creado: Date.now(),
    })
    setNuevo(null)
  }

  const clase = `gasto-row ${modoEdicion ? 'gasto-row--editando' : ''}`

  return (
    <>
      <div className="resumen__nav">
        <button
          className="btn btn--ghost"
          onClick={() => setMes(shiftMonth(mes, -1))}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span className="resumen__mes">{formatMonth(mes)}</span>
        <button
          className="btn btn--ghost"
          onClick={() => setMes(shiftMonth(mes, 1))}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {error && <p className="banner banner--error">No se pudo guardar: {error.message}</p>}

      <div className="resumen__total">
        <span className="resumen__total-label">Gastos fijos del mes</span>
        <span className="resumen__total-value resumen__total-value--gasto">
          {formatMoney(total)}
        </span>
      </div>

      <div className="resumen__cards">
        <div className="resumen__card" style={{ '--pago-color': '#16a34a' }}>
          <span className="resumen__card-label">Pagado</span>
          <span className="resumen__card-value">{formatMoney(pagado)}</span>
        </div>
        <div className="resumen__card" style={{ '--pago-color': '#f59e0b' }}>
          <span className="resumen__card-label">Falta pagar</span>
          <span className="resumen__card-value">{formatMoney(pendiente)}</span>
        </div>
      </div>

      <section className="cfg-section">
        <div className="cfg-section__head">
          <h3 className="cfg-section__title">Gastos fijos</h3>
          <div className="cfg-actions">
            {modoEdicion && (
              <button
                className="btn btn--add"
                onClick={() => setNuevo({ id: uid(), nombre: '', monto: '' })}
                disabled={!!nuevo}
              >
                + Gasto
              </button>
            )}
            <button
              className={modoEdicion ? 'btn btn--primary' : 'btn btn--ghost-sm'}
              onClick={() => {
                if (modoEdicion) setNuevo(null)
                setModoEdicion(!modoEdicion)
              }}
            >
              {modoEdicion ? 'Listo' : '✎ Editar'}
            </button>
          </div>
        </div>
        <p className="cfg-hint">
          El monto de referencia es lo que suele salir cada gasto; sirve para saber cuánto falta
          pagar antes de que llegue la factura. Al marcar el pago se carga lo que se pagó de verdad,
          que es lo que cuenta en el mes. Los gastos se repiten todos los meses: quitar uno acá no
          borra lo que ya se pagó en meses anteriores.
        </p>

        {!pagos ? (
          <p className="muted resumen__estado">Cargando…</p>
        ) : (
          <>
            {(filas.length > 0 || nuevo) && (
              <div className={`gasto-head ${modoEdicion ? 'gasto-head--editando' : ''}`}>
                <span>Gasto</span>
                <span>Monto</span>
                <span>Pagado</span>
                <span />
                {modoEdicion && <span />}
              </div>
            )}

            {nuevo && (
              <div className={clase}>
                <input
                  className="cfg-input"
                  placeholder="Nombre del gasto"
                  value={nuevo.nombre}
                  autoFocus
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNuevo()}
                />
                <input
                  className="cfg-input cfg-input--price"
                  inputMode="numeric"
                  placeholder="$ por mes"
                  value={nuevo.monto}
                  onChange={(e) => setNuevo({ ...nuevo, monto: soloDigitos(e.target.value) })}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNuevo()}
                />
                <span />
                <button
                  className="cfg-row__ok"
                  onClick={guardarNuevo}
                  disabled={!nuevo.nombre.trim()}
                  title="Agregar el gasto"
                  aria-label="Agregar el gasto"
                >
                  ✓
                </button>
                <BotonBorrar
                  onConfirm={() => setNuevo(null)}
                  confirmar={false}
                  label="Descartar"
                  title="Descartar"
                />
              </div>
            )}

            {filas.length === 0 && !nuevo && (
              <p className="consumos__empty muted">
                Todavía no hay gastos fijos cargados. Entrá en "✎ Editar" y agregá el alquiler, la
                luz, el internet…
              </p>
            )}

            {filas.map((f) => (
              <div key={f.id}>
                <div className={`${clase} ${f.pagado ? 'gasto-row--pagado' : ''}`}>
                  {modoEdicion && f.enPlantilla ? (
                    <>
                      <CampoTexto
                        valor={f.nombre}
                        onGuardar={(nombre) => saveGasto({ id: f.id, nombre })}
                        label="Nombre del gasto"
                      />
                      <CampoNumero
                        valor={f.montoRef}
                        onGuardar={(monto) => saveGasto({ id: f.id, monto: Number(monto) || 0 })}
                        label={`Monto de referencia de ${f.nombre}`}
                      />
                    </>
                  ) : (
                    <>
                      <span className="gasto-row__nombre">
                        {f.nombre}
                        {!f.enPlantilla && (
                          <span className="muted gasto-row__baja"> (ya no está en la lista)</span>
                        )}
                      </span>
                      <span className="gasto-row__num">{formatMoney(f.monto)}</span>
                    </>
                  )}

                  <span className="gasto-row__fecha">
                    {f.pagado ? (f.pago.fecha ? formatDateNumeric(f.pago.fecha) : '✓') : '—'}
                  </span>

                  <button
                    className={`gasto-row__pagar ${f.pagado ? 'is-pagado' : ''}`}
                    onClick={() => setPagando(pagando === f.id ? null : f.id)}
                    title={
                      f.pagado ? `Corregir el pago de ${f.nombre}` : `Marcar ${f.nombre} como pagado`
                    }
                  >
                    {pagando === f.id ? 'Cancelar' : f.pagado ? 'Pagado ✓' : 'Pagar'}
                  </button>

                  {modoEdicion &&
                    (f.enPlantilla ? (
                      <BotonBorrar onConfirm={() => deleteGasto(f.id)} title="Quitar gasto fijo" />
                    ) : (
                      <span />
                    ))}
                </div>

                {pagando === f.id && (
                  <PagoForm
                    titulo={
                      f.pagado ? `Pago de ${f.nombre}` : `Pagar ${f.nombre} — ${formatMonth(mes)}`
                    }
                    montoInicial={f.pagado ? f.pago.monto : f.montoRef}
                    fechaInicial={f.pagado ? f.pago.fecha || fechaSugerida : fechaSugerida}
                    textoConfirmar={f.pagado ? 'Guardar' : 'Marcar pagado'}
                    onCancel={() => setPagando(null)}
                    onConfirm={(monto, fecha) =>
                      f.pagado ? corregirPago(f, monto, fecha) : pagar(f, monto, fecha)
                    }
                    onDeshacer={f.pagado ? () => deshacerPago(f) : null}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </section>
    </>
  )
}

/**
 * Alta o corrección del pago de un gasto en el mes: cuánto se pagó y qué día. El
 * monto arranca en el de referencia, que casi siempre es el que va.
 */
function PagoForm({
  titulo,
  montoInicial,
  fechaInicial,
  textoConfirmar,
  onCancel,
  onConfirm,
  onDeshacer,
}) {
  const [monto, setMonto] = useState(String(montoInicial || ''))
  const [fecha, setFecha] = useState(fechaInicial)

  const importe = Number(monto) || 0

  return (
    <div className="stock-compra-form">
      <p className="dividir__head">{titulo}</p>
      <div className="stock-compra-form__campos">
        <label className="stock-label">
          Monto
          <input
            className="cfg-input cfg-input--price"
            inputMode="numeric"
            autoFocus
            value={monto}
            onChange={(e) => setMonto(soloDigitos(e.target.value))}
          />
        </label>
        <label className="stock-label">
          Fecha
          <input
            className="cfg-input cfg-input--fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <span className="stock-compra-form__total">{formatMoney(importe)}</span>
      </div>
      <div className="dividir__acciones">
        <button
          className="btn btn--primary"
          disabled={importe <= 0}
          onClick={() => onConfirm(importe, fecha)}
        >
          {textoConfirmar}
        </button>
        <button className="btn btn--ghost-sm" onClick={onCancel}>
          Cancelar
        </button>
        {onDeshacer && (
          <button className="btn btn--ghost-sm" onClick={onDeshacer}>
            Deshacer pago
          </button>
        )}
      </div>
    </div>
  )
}

// Nombre del gasto: se guarda al salir del campo (o con Enter), no en cada tecla.
function CampoTexto({ valor, onGuardar, label }) {
  const [texto, setTexto] = useState(valor)
  const [editando, setEditando] = useState(false)

  const guardar = () => {
    setEditando(false)
    const limpio = texto.trim()
    if (!limpio || limpio === valor) return
    onGuardar(limpio)
  }

  return (
    <input
      className="cfg-input"
      aria-label={label}
      value={editando ? texto : valor}
      onFocus={() => {
        setTexto(valor)
        setEditando(true)
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

// Monto de referencia: mismo criterio que el nombre, guardar al salir. Vacío es
// alguien que borró para escribir otra cosa y se fue, no un "cero".
function CampoNumero({ valor, onGuardar, label }) {
  const [texto, setTexto] = useState(String(valor))
  const [editando, setEditando] = useState(false)

  const guardar = () => {
    setEditando(false)
    if (texto === '' || texto === String(valor)) return
    onGuardar(texto)
  }

  return (
    <input
      className="cfg-input cfg-input--price"
      inputMode="numeric"
      aria-label={label}
      value={editando ? texto : String(valor)}
      onFocus={() => {
        setTexto(String(valor))
        setEditando(true)
      }}
      onChange={(e) => setTexto(soloDigitos(e.target.value))}
      onBlur={guardar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
