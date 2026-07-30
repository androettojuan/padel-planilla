import { useState } from 'react'
import { PAGOS_BY_ID } from '../data/defaults'
import { formatMoney } from '../utils/helpers'
import { pagosDe, saldoTurno, totalPagado } from '../utils/turnos'
import NombreInput from './NombreInput'
import PagoSelector from './PagoSelector'
import BotonBorrar from './BotonBorrar'

/**
 * Celda de turno en el modo "reserva": una sola línea con quién reservó y cuánto
 * sale el turno, y debajo los pagos que se van cargando encima —cada jugador que
 * pone su parte, con su medio— hasta cubrir el precio.
 *
 * El estado del turno no se marca a mano: sale de comparar lo pagado con el
 * precio, así el "falta $X" nunca puede contradecir a los pagos cargados.
 */
export default function ReservaCell({ turno, onUpdate, onAddPago, onRemovePago, sugerencias, onCommitNombre }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState('contado')

  const pagos = pagosDe(turno)
  const precio = Number(turno?.monto) || 0
  const pagado = totalPagado(turno)
  const falta = saldoTurno(turno)
  const saldado = precio > 0 && falta === 0

  const confirmar = () => {
    const valor = Number(monto) || 0
    if (valor <= 0) return
    onAddPago({ nombre, monto: valor, pago: medio })
    setNombre('')
    setMonto('')
    setAbierto(false)
  }

  // Sugerido: lo que falta para cerrar el turno, que es el caso más común.
  const abrirPago = () => {
    setMonto(String(falta > 0 ? falta : ''))
    setAbierto(true)
  }

  return (
    <div className="cgrid__cell reserva">
      <div className="reserva__head">
        <NombreInput
          className="player__name"
          placeholder="Quién reservó"
          value={turno?.jugador || ''}
          sugerencias={sugerencias}
          onChange={(v) => onUpdate({ jugador: v })}
          onCommit={onCommitNombre}
        />
        <input
          className="player__money"
          inputMode="numeric"
          placeholder="$"
          value={turno?.monto ?? ''}
          onChange={(e) => onUpdate({ monto: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>

      {pagos.length > 0 && (
        <ul className="reserva__pagos">
          {pagos.map((p) => {
            const m = PAGOS_BY_ID[p.pago]
            return (
              <li className="reserva__pago" key={p.id}>
                <span className="reserva__pago-nombre">{p.nombre || '—'}</span>
                <span className="reserva__pago-monto">{formatMoney(p.monto)}</span>
                <span
                  className="pago pago--sm pago--lock"
                  style={{ '--pago-color': m?.color }}
                  title={m?.label}
                >
                  {m?.short || 'OK'}
                </span>
                <BotonBorrar onConfirm={() => onRemovePago(p.id)} title="Quitar este pago" />
              </li>
            )
          })}
        </ul>
      )}

      {abierto ? (
        <div className="reserva__form">
          <NombreInput
            className="player__name"
            placeholder="Quién paga (opcional)"
            value={nombre}
            sugerencias={sugerencias}
            onChange={setNombre}
            onCommit={onCommitNombre}
            onEnter={confirmar}
          />
          <input
            className="player__money"
            inputMode="numeric"
            placeholder="$"
            autoFocus
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ''))}
          />
          <PagoSelector value={medio} onChange={setMedio} size="sm" />
          <button className="btn btn--primary btn--sm" onClick={confirmar} disabled={!(Number(monto) > 0)}>
            ✓
          </button>
          <button className="btn btn--ghost-sm" onClick={() => setAbierto(false)}>
            ✕
          </button>
        </div>
      ) : (
        <div className="reserva__pie">
          <button className="cell__add" onClick={abrirPago}>
            + Pago
          </button>
          {precio > 0 &&
            (saldado ? (
              <span className="reserva__estado reserva__estado--ok">Saldado</span>
            ) : (
              <span className="reserva__estado">
                {pagado > 0 ? `Falta ${formatMoney(falta)}` : formatMoney(precio)}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
