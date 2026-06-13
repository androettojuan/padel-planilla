import CourtCard from './CourtCard'

export default function CourtsBoard({ config, planilla, update, loading }) {
  return (
    <div className="courts">
      <div className="courts__head">
        <h2 className="section-title">Turnos</h2>
        {loading && <span className="muted">cargando…</span>}
      </div>
      <div className="courts__grid">
        {config.canchas.map((cancha) => (
          <CourtCard
            key={cancha.id}
            cancha={cancha}
            horarios={config.horarios}
            turnos={planilla.turnos || {}}
            update={update}
          />
        ))}
      </div>
    </div>
  )
}
