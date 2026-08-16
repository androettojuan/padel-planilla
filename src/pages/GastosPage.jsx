import { useEffect, useMemo, useState } from 'react'
import { useClubId } from '../hooks/useClub'
import { loadGastosMes, agregarGasto, borrarGasto } from '../firebase/gastos'
import { totalGastos, ordenarGastos } from '../utils/gastos'
import {
  formatMoney,
  formatMonth,
  formatDateNumeric,
  shiftMonth,
  soloDigitos,
  todayKey,
} from '../utils/helpers'
import BotonBorrar from '../components/BotonBorrar'

// Último día del mes ("YYYY-MM"), para que el calendario no deje elegir una
// fecha fuera del mes que se está mirando: el gasto se cargaría y desaparecería.
function finDeMes(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

/**
 * Los gastos del club, mes por mes: cuándo se pagó, qué (luz, agua, gas, lo que
 * sea) y cuánto. No hay lista fija ni nada que configurar antes: se escribe el
 * gasto y se carga, como una compra de mercadería. El total va al resumen del
 * mes, así lo facturado no se lee como si fuera lo que queda.
 */
export default function GastosPage({ monthKey }) {
  const clubId = useClubId()
  const [mes, setMes] = useState(monthKey)
  const [gastos, setGastos] = useState(null) // null = cargando
  const [error, setError] = useState(null)

  // Un gasto se anota el día que se paga: si se está mirando un mes viejo, la
  // fecha que se propone es la de ese mes, no la de hoy.
  const fechaSugerida = todayKey().startsWith(mes) ? todayKey() : `${mes}-01`
  const [fecha, setFecha] = useState(fechaSugerida)
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')

  useEffect(() => {
    let active = true
    setGastos(null)
    loadGastosMes(clubId, mes)
      .then((g) => active && setGastos(g))
      .catch((e) => active && setError(e))
    return () => {
      active = false
    }
  }, [clubId, mes])

  // Al cambiar de mes el formulario arranca con una fecha de ese mes.
  useEffect(() => {
    setFecha(todayKey().startsWith(mes) ? todayKey() : `${mes}-01`)
  }, [mes])

  const lista = useMemo(() => ordenarGastos(gastos || []), [gastos])
  const total = useMemo(() => totalGastos(gastos || []), [gastos])

  const importe = Number(monto) || 0
  const puedeCargar = !!nombre.trim() && importe > 0 && !!fecha

  // La lista se actualiza en memoria: la operación ya sabe con qué quedó, así
  // que volver a pedir el mes por red sería una lectura al pedo.
  const cargar = async () => {
    if (!puedeCargar) return
    setError(null)
    try {
      const gasto = await agregarGasto(clubId, { nombre, monto: importe, fecha })
      if (gasto) setGastos((prev) => [...(prev || []), gasto])
      setNombre('')
      setMonto('')
    } catch (err) {
      setError(err)
    }
  }

  const borrar = async (id) => {
    setError(null)
    try {
      await borrarGasto(clubId, id)
      setGastos((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      setError(err)
    }
  }

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
        <span className="resumen__total-label">Gastos del mes</span>
        <span className="resumen__total-value resumen__total-value--gasto">
          {formatMoney(total)}
        </span>
      </div>

      <section className="cfg-section">
        <div className="cfg-section__head">
          <h3 className="cfg-section__title">Cargar un gasto</h3>
        </div>
        <div className="gasto-form">
          <label className="stock-label">
            Fecha
            <input
              className="cfg-input cfg-input--fecha"
              type="date"
              value={fecha}
              min={`${mes}-01`}
              max={finDeMes(mes)}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label className="stock-label gasto-form__desc">
            Gasto
            <input
              className="cfg-input"
              placeholder="Luz, agua, gas…"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && cargar()}
            />
          </label>
          <label className="stock-label">
            Monto
            <input
              className="cfg-input cfg-input--price"
              inputMode="numeric"
              placeholder="$"
              value={monto}
              onChange={(e) => setMonto(soloDigitos(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && cargar()}
            />
          </label>
          <button className="btn btn--primary" disabled={!puedeCargar} onClick={cargar}>
            Cargar gasto
          </button>
        </div>

        {!gastos ? (
          <p className="muted resumen__estado">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="consumos__empty muted">No hay gastos cargados en este mes.</p>
        ) : (
          <>
            <div className="gasto-head">
              <span>Fecha</span>
              <span>Gasto</span>
              <span>Monto</span>
              <span />
            </div>
            {lista.map((g) => (
              <div className="gasto-row" key={g.id}>
                <span className="gasto-row__fecha">
                  {g.fecha ? formatDateNumeric(g.fecha) : '—'}
                </span>
                <span className="gasto-row__nombre">{g.nombre}</span>
                <span className="gasto-row__num">{formatMoney(g.monto)}</span>
                <BotonBorrar onConfirm={() => borrar(g.id)} title={`Borrar el gasto de ${g.nombre}`} />
              </div>
            ))}
          </>
        )}
      </section>
    </>
  )
}
