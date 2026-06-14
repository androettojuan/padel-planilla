import { useState } from 'react'
import { PAGOS_BY_ID } from '../data/defaults'
import NombreInput from './NombreInput'

// Cada turno muestra siempre al menos esta cantidad de jugadores.
export const MIN_JUGADORES = 4

export default function SlotCell({ jugadores, onAdd, onUpdate, onRemove, sugerencias, onCommitNombre }) {
  // Índice de la fila con la confirmación de borrado abierta.
  const [confirmIdx, setConfirmIdx] = useState(null)

  // Completamos con filas "fantasma" (null) hasta el mínimo. No están
  // persistidas: recién al escribir algo se materializan como jugadores reales.
  const rows = jugadores.slice()
  while (rows.length < MIN_JUGADORES) rows.push(null)

  const requestRemove = (index, j) => {
    const hasData = (j.jugador || '').trim() || String(j.monto || '').trim()
    if (hasData) setConfirmIdx(index)
    else onRemove(index)
  }

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
                onChange={(e) => onUpdate(index, { monto: e.target.value.replace(/[^\d]/g, '') })}
              />
              {val.pagado ? (
                <span
                  className="pago pago--sm pago--lock"
                  style={{ '--pago-color': medio?.color }}
                  title={`Pagado · ${medio?.label || ''}`}
                >
                  ✓ {medio?.short || 'OK'}
                </span>
              ) : confirmIdx === index ? (
                <div className="confirm-inline">
                  <button
                    className="confirm-inline__yes"
                    onClick={() => {
                      onRemove(index)
                      setConfirmIdx(null)
                    }}
                    aria-label="Confirmar"
                    title="Borrar"
                  >
                    ✓
                  </button>
                  <button
                    className="confirm-inline__no"
                    onClick={() => setConfirmIdx(null)}
                    aria-label="Cancelar"
                    title="Cancelar"
                  >
                    ✕
                  </button>
                </div>
              ) : ghost ? (
                <span className="player__del player__del--ghost" aria-hidden="true" />
              ) : (
                <button
                  className="player__del"
                  onClick={() => requestRemove(index, val)}
                  aria-label="Quitar"
                >
                  ×
                </button>
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
