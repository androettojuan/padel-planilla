import { turnoKey, horarioLabel } from '../data/defaults'

// Nombre que agrupa las líneas sin jugador asignado.
export const SIN_ASIGNAR = ''
export const SIN_ASIGNAR_LABEL = 'Sin asignar'

const nombreDe = (item) => (item?.jugador || '').trim()

const sumTurnos = (arr) => arr.reduce((s, t) => s + (Number(t.monto) || 0), 0)
const sumConsumos = (arr) =>
  arr.reduce((s, c) => s + (Number(c.precio) || 0) * (Number(c.cantidad) || 0), 0)

/**
 * Agrupa la planilla en "cuentas" por jugador. Cada pago es independiente: las
 * líneas sin cobrar forman una cuenta pendiente, y las ya cobradas se agrupan
 * por medio de pago (un turno pagado con Mercado Pago y un consumo posterior
 * pagado en efectivo son dos cuentas pagadas distintas).
 *
 * Así, agregar un consumo nuevo a un jugador ya cobrado genera una cuenta
 * pendiente nueva por ese consumo, sin tocar lo ya pagado.
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
    // Cuenta pendiente: lo que todavía no se cobró del jugador.
    const turnosPend = g.turnos.filter((t) => !t.pagado)
    const consumosPend = g.consumos.filter((c) => !c.pagado)
    const totalTurnos = sumTurnos(turnosPend)
    const totalConsumos = sumConsumos(consumosPend)
    if (totalTurnos + totalConsumos > 0 || consumosPend.length > 0) {
      cuentas.push({
        nombre: g.nombre,
        turnos: turnosPend,
        consumos: consumosPend,
        totalTurnos,
        totalConsumos,
        total: totalTurnos + totalConsumos,
        pagado: false,
        medio: null,
      })
    }

    // Cuentas pagadas: una por medio de pago, para no mezclar cobros distintos.
    const porMedio = new Map()
    const acumular = (item, tipo) => {
      if (!item.pagado) return
      if (!porMedio.has(item.pago)) porMedio.set(item.pago, { turnos: [], consumos: [] })
      porMedio.get(item.pago)[tipo].push(item)
    }
    g.turnos.forEach((t) => acumular(t, 'turnos'))
    g.consumos.forEach((c) => acumular(c, 'consumos'))
    for (const [medio, grp] of porMedio) {
      const tt = sumTurnos(grp.turnos)
      const tc = sumConsumos(grp.consumos)
      cuentas.push({
        nombre: g.nombre,
        turnos: grp.turnos,
        consumos: grp.consumos,
        totalTurnos: tt,
        totalConsumos: tc,
        total: tt + tc,
        pagado: true,
        medio,
      })
    }
  }

  // Pendientes primero; dentro de cada grupo, por nombre.
  return cuentas.sort((a, b) => {
    if (a.pagado !== b.pagado) return a.pagado ? 1 : -1
    return (a.nombre || '￿').localeCompare(b.nombre || '￿')
  })
}

// Cobra o revierte el pago del jugador, sin tocar otros cobros suyos.
// Al cobrar (pagado=true) marca solo las líneas todavía pendientes con `medio`.
// Al revertir (pagado=false) afecta solo las líneas cobradas con ese `medio`.
export function aplicarPago(planilla, nombre, medio, pagado) {
  const objetivo = (nombre || '').trim()
  const pertenece = (item) => (item?.jugador || '').trim() === objetivo
  const afecta = pagado
    ? (item) => pertenece(item) && !item.pagado
    : (item) => pertenece(item) && item.pagado && item.pago === medio
  const aplicar = (item) =>
    afecta(item)
      ? pagado
        ? { ...item, pagado: true, pago: medio }
        : { ...item, pagado: false, pago: null }
      : item

  const turnos = {}
  for (const [key, lista] of Object.entries(planilla.turnos || {})) {
    turnos[key] = lista.map(aplicar)
  }
  const consumos = (planilla.consumos || []).map(aplicar)

  return { ...planilla, turnos, consumos }
}

export { turnoKey }
