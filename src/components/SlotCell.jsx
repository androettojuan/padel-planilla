import { PAGOS_BY_ID } from '../data/defaults'
import { soloDigitos } from '../utils/helpers'
import BotonBorrar from './BotonBorrar'
import NombreInput from './NombreInput'

// Cada turno muestra siempre al menos esta cantidad de jugadores.
export const MIN_JUGADORES = 4

export default function SlotCell({ jugadores, onAdd, onUpdate, onRemove, sugerencias, onCommitNombre }) {
  // Completamos con filas "fantasma" (null) hasta el mínimo. No están
  // persistidas: recién al escribir algo se materializan como jugadores reales.
  const rows = jugadores.slice()
  while (rows.length < MIN_JUGADORES) rows.push(null)

  return (
    <div className="cgrid__cell">
      <ul className="players">
        {rows.map((j, index) => {
          const ghost = j === null
          const val = j || { jugador: '', monto: '', pagado: false }
          const medio = val.pagado ? PAGOS_BY_ID[val.pago] : null
          return (
            // key por índice: al materializar una fila fantasma el input no se
            // remonta y no se pierde el foco mientras se escribe.
            <li className={`player ${val.pagado ? 'player--pagado' : ''}`} key={index}>
              <NombreInput
                className="player__name"
                placeholder="Nombre"
                value={val.jugador}
                disabled={val.pagado}
                sugerencias={sugerencias}
                onChange={(v) => onUpdate(index, { jugador: v })}
                onCommit={onCommitNombre}
              />
              <input
                className="player__money"
                inputMode="numeric"
                placeholder="$"
                value={val.monto}
                disabled={val.pagado}
                onChange={(e) => onUpdate(index, { monto: soloDigitos(e.target.value) })}
              />
              {val.pagado ? (
                <span
                  className="pago pago--sm pago--lock"
                  style={{ '--pago-color': medio?.color }}
                  title={`Pagado · ${medio?.label || ''}`}
                >
                  ✓ {medio?.short || 'OK'}
                </span>
              ) : ghost ? (
                <span className="player__del player__del--ghost" aria-hidden="true" />
              ) : (
                <BotonBorrar
                  // Una fila en blanco se borra de una: no hay nada que perder.
                  confirmar={!!((val.jugador || '').trim() || String(val.monto || '').trim())}
                  onConfirm={() => onRemove(index)}
                />
              )}
            </li>
          )
        })}
      </ul>
      <button className="cell__add" onClick={onAdd}>
        + Jugador
      </button>
    </div>
  )
}
