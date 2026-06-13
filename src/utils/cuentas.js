import { turnoKey, horarioLabel } from '../data/defaults'

// Nombre que agrupa las líneas sin jugador asignado.
export const SIN_ASIGNAR = ''
export const SIN_ASIGNAR_LABEL = 'Sin asignar'

const nombreDe = (item) => (item?.jugador || '').trim()

/**
 * Agrupa la planilla en "cuentas" por jugador: cada cuenta junta las líneas de
 * turno y los consumos de ese jugador, con sus totales y estado de pago.
 *
 * Una cuenta está pagada cuando tiene al menos una línea y todas están pagadas;
 * el medio se toma de la primera línea cobrada. Si se agrega un consumo nuevo a
 * un jugador ya cobrado, la cuenta vuelve a quedar pendiente por el saldo nuevo.
 */
export function buildCuentas(planilla, config) {
  const canchas = config?.canchas || []
  const horarios = config?.horarios || []
  const canchaNombre = (id) => canchas.find((c) => c.id === id)?.nombre || id
  const horarioDe = (id) => horarioLabel(horarios.find((h) => h.id === id))

  const groups = new Map()
  const getGroup = (nombre) => {
    if (!groups.has(nombre)) groups.set(nombre, { nombre, turnos: [], consumos: [] })
    return groups.get(nombre)
  }

  for (const [key, lista] of Object.entries(planilla?.turnos || {})) {
    const [canchaId, horarioId] = key.split('__')
    for (const item of lista) {
      getGroup(nombreDe(item)).turnos.push({
        ...item,
        canchaId,
        horarioId,
        canchaNombre: canchaNombre(canchaId),
        horario: horarioDe(horarioId),
      })
    }
  }
  for (const c of planilla?.consumos || []) {
    getGroup(nombreDe(c)).consumos.push(c)
  }

  const cuentas = []
  for (const g of groups.values()) {
    const totalTurnos = g.turnos.reduce((s, t) => s + (Number(t.monto) || 0), 0)
    const totalConsumos = g.consumos.reduce(
      (s, c) => s + (Number(c.precio) || 0) * (Number(c.cantidad) || 0),
      0,
    )
    const total = totalTurnos + totalConsumos
    if (total <= 0 && g.consumos.length === 0) continue // nada para cobrar todavía

    const items = [...g.turnos, ...g.consumos]
    const pagado = items.length > 0 && items.every((i) => i.pagado)
    const medio = pagado ? items.find((i) => i.pagado)?.pago : null

    cuentas.push({ ...g, totalTurnos, totalConsumos, total, pagado, medio })
  }

  // Pendientes primero; dentro de cada grupo, por nombre.
  return cuentas.sort((a, b) => {
    if (a.pagado !== b.pagado) return a.pagado ? 1 : -1
    return (a.nombre || '￿').localeCompare(b.nombre || '￿')
  })
}

// Marca o revierte el pago de todas las líneas (turnos + consumos) del jugador.
export function aplicarPago(planilla, nombre, medio, pagado) {
  const objetivo = (nombre || '').trim()
  const pertenece = (item) => (item?.jugador || '').trim() === objetivo
  const patch = pagado ? { pagado: true, pago: medio } : { pagado: false }

  const turnos = {}
  for (const [key, lista] of Object.entries(planilla.turnos || {})) {
    turnos[key] = lista.map((t) => (pertenece(t) ? { ...t, ...patch } : t))
  }
  const consumos = (planilla.consumos || []).map((c) => (pertenece(c) ? { ...c, ...patch } : c))

  return { ...planilla, turnos, consumos }
}

export { turnoKey }
