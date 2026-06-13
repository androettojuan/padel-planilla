import { turnoKey, PAGOS } from '../data/defaults'
import { uid, formatMoney } from '../utils/helpers'
import SlotBlock from './SlotBlock'

export default function CourtCard({ cancha, horarios, turnos, update }) {
  const subtotal = horarios.reduce((sum, h) => {
    const lista = turnos[turnoKey(cancha.id, h.id)] || []
    return sum + lista.reduce((s, t) => s + (Number(t.monto) || 0), 0)
  }, 0)

  const mutateSlot = (horarioId, fn) => {
    const key = turnoKey(cancha.id, horarioId)
    update((prev) => {
      const lista = prev.turnos[key] || []
      return { ...prev, turnos: { ...prev.turnos, [key]: fn(lista) } }
    })
  }

  const addPlayer = (horarioId) =>
    mutateSlot(horarioId, (lista) => [
      ...lista,
      { id: uid(), jugador: '', monto: '', pago: PAGOS[0].id },
    ])

  const updatePlayer = (horarioId, id, patch) =>
    mutateSlot(horarioId, (lista) => lista.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const removePlayer = (horarioId, id) =>
    mutateSlot(horarioId, (lista) => lista.filter((t) => t.id !== id))

  return (
    <div className="court">
      <div className="court__header">
        <h3 className="court__name">{cancha.nombre}</h3>
        <span className="court__subtotal">{formatMoney(subtotal)}</span>
      </div>
      <div className="court__slots">
        {horarios.map((h) => (
          <SlotBlock
            key={h.id}
            horario={h}
            jugadores={turnos[turnoKey(cancha.id, h.id)] || []}
            onAdd={() => addPlayer(h.id)}
            onUpdate={(id, patch) => updatePlayer(h.id, id, patch)}
            onRemove={(id) => removePlayer(h.id, id)}
          />
        ))}
      </div>
    </div>
  )
}
