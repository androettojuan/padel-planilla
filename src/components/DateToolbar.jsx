import { PAGOS } from '../data/defaults'
import { formatLongDate, formatMoney, shiftDateKey, todayKey } from '../utils/helpers'

export default function DateToolbar({ dateKey, onChange, totals }) {
  return (
    <div className="toolbar">
      <div className="toolbar__date">
        <button className="btn btn--ghost" onClick={() => onChange(shiftDateKey(dateKey, -1))} aria-label="Día anterior">
          ‹
        </button>
        <div className="toolbar__date-center">
          <input
            type="date"
            className="toolbar__date-input"
            value={dateKey}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
          <span className="toolbar__date-label">{formatLongDate(dateKey)}</span>
        </div>
        <button className="btn btn--ghost" onClick={() => onChange(shiftDateKey(dateKey, 1))} aria-label="Día siguiente">
          ›
        </button>
        <button className="btn btn--today" onClick={() => onChange(todayKey())}>
          Hoy
        </button>
      </div>

      <div className="toolbar__chips">
        {PAGOS.map((p) => (
          <div key={p.id} className="chip" style={{ '--chip-color': p.color }}>
            <span className="chip__dot" />
            <span className="chip__label">{p.label}</span>
            <span className="chip__value">{formatMoney(totals[p.id] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
