import { useState } from 'react'
import { PAGOS_BY_ID } from '../data/defaults'

export default function SlotCell({ jugadores, onAdd, onUpdate, onRemove }) {
  const [confirmId, setConfirmId] = useState(null)

  const requestRemove = (j) => {
    const hasData = (j.jugador || '').trim() || String(j.monto || '').trim()
    if (hasData) setConfirmId(j.id)
    else onRemove(j.id)
  }

  if (jugadores.length === 0) {
    return (
      <div className="cgrid__cell">
        <button className="slot__empty" onClick={onAdd}>
          Libre — anotar jugador
        </button>
      </div>
    )
  }

  return (
    <div className="cgrid__cell">
      <ul className="players">
        {jugadores.map((j) => {
          const medio = j.pagado ? PAGOS_BY_ID[j.pago] : null
          return (
            <li className={`player ${j.pagado ? 'player--pagado' : ''}`} key={j.id}>
              <input
                className="player__name"
                placeholder="Nombre"
                value={j.jugador}
                disabled={j.pagado}
                onChange={(e) => onUpdate(j.id, { jugador: e.target.value })}
              />
              <input
                className="player__money"
                inputMode="numeric"
                placeholder="$"
                value={j.monto}
                disabled={j.pagado}
                onChange={(e) => onUpdate(j.id, { monto: e.target.value.replace(/[^\d]/g, '') })}
              />
              {j.pagado ? (
                <span
                  className="pago pago--sm pago--lock"
                  style={{ '--pago-color': medio?.color }}
                  title={`Pagado · ${medio?.label || ''}`}
                >
                  ✓ {medio?.short || 'OK'}
                </span>
              ) : confirmId === j.id ? (
                <div className="confirm-inline">
                  <button
                    className="confirm-inline__yes"
                    onClick={() => {
                      onRemove(j.id)
                      setConfirmId(null)
                    }}
                    aria-label="Confirmar"
                    title="Borrar"
                  >
                    ✓
                  </button>
                  <button
                    className="confirm-inline__no"
                    onClick={() => setConfirmId(null)}
                    aria-label="Cancelar"
                    title="Cancelar"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button className="player__del" onClick={() => requestRemove(j)} aria-label="Quitar">
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
