import PagoSelector from './PagoSelector'

export default function SlotBlock({ label, jugadores, onAdd, onUpdate, onRemove }) {
  return (
    <div className="slot">
      <div className="slot__head">
        <span className="slot__time">{label}</span>
        <button className="btn btn--add" onClick={onAdd}>
          + Jugador
        </button>
      </div>

      {jugadores.length === 0 ? (
        <button className="slot__empty" onClick={onAdd}>
          Libre — anotar jugador
        </button>
      ) : (
        <ul className="players">
          {jugadores.map((j) => (
            <li className="player" key={j.id}>
              <input
                className="player__name"
                placeholder="Nombre"
                value={j.jugador}
                onChange={(e) => onUpdate(j.id, { jugador: e.target.value })}
              />
              <input
                className="player__money"
                inputMode="numeric"
                placeholder="$"
                value={j.monto}
                onChange={(e) => onUpdate(j.id, { monto: e.target.value.replace(/[^\d]/g, '') })}
              />
              <PagoSelector value={j.pago} size="sm" onChange={(pago) => onUpdate(j.id, { pago })} />
              <button className="player__del" onClick={() => onRemove(j.id)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
