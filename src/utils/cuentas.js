import { turnoKey, horarioLabel, buscarFranja } from '../data/defaults'
import { duenioDeGrupo, MOSTRADOR_LABEL } from './consumos'
import {
  agregarPago,
  lineasDeTurno,
  pagosDe,
  saldoTurno,
  tienePagos,
} from './turnos'

// Nombre que agrupa las líneas sin jugador asignado.
export const SIN_ASIGNAR = ''
export const SIN_ASIGNAR_LABEL = 'Sin asignar'
// Consumo de alguien que no estaba jugando (una venta suelta del bar).
export { MOSTRADOR_LABEL }

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
 *
 * Los consumos de mostrador (gente que no jugaba) no se agrupan: cada venta es
 * su propia cuenta, porque cada persona de afuera paga lo suyo y se va. Por eso
 * cada cuenta lleva `key`, que es con lo que se la identifica para cobrarla.
 */
export function buildCuentas(planilla, config) {
  const canchas = config?.canchas || []
  const canchaNombre = (id) => canchas.find((c) => c.id === id)?.nombre || id
  // La franja se busca primero en la cancha del turno, que puede tener horario
  // propio, y si no aparece ahí se cae a las listas del club.
  const horarioDe = (canchaId, horarioId) =>
    horarioLabel(buscarFranja(config, canchaId, horarioId))

  const groups = new Map()
  const getGroup = (key, extra = {}) => {
    if (!groups.has(key)) groups.set(key, { key, turnos: [], consumos: [], ...extra })
    return groups.get(key)
  }
  // Los consumos sin dueño —una venta de mostrador, o la parte de algo dividido
  // sin decir entre quiénes— van cada uno en su propia cuenta: nadie puede
  // cobrarlos juntos porque no se sabe si son de la misma persona. El resto se
  // junta por jugador, como siempre.
  const suelto = (c) => !nombreDe(c) && (c.mostrador || c.parte?.de > 1)
  const consumosTodos = planilla?.consumos || []
  const grupoDeConsumo = (c) =>
    suelto(c)
      ? getGroup(`suelto#${c.id}`, {
          nombre: c.mostrador ? MOSTRADOR_LABEL : '',
          mostrador: !!c.mostrador,
          suelto: true,
          // De quién es el producto compartido, para no perder de vista que esta
          // parte suelta salió del turno de alguien.
          referencia: duenioDeGrupo(consumosTodos, c),
        })
      : getGroup(nombreDe(c), { nombre: nombreDe(c) })

  for (const [key, lista] of Object.entries(planilla?.turnos || {})) {
    const [canchaId, horarioId] = key.split('__')
    for (const item of lista) {
      // Un turno de reserva se abre en una línea por pago más lo que falte, cada
      // una a nombre de quien corresponda: así cada uno ve en su cuenta lo suyo.
      for (const linea of lineasDeTurno(item)) {
        getGroup(nombreDe(linea), { nombre: nombreDe(linea) }).turnos.push({
          ...linea,
          canchaId,
          horarioId,
          canchaNombre: canchaNombre(canchaId),
          horario: horarioDe(canchaId, horarioId),
        })
      }
    }
  }
  for (const c of planilla?.consumos || []) {
    grupoDeConsumo(c).consumos.push(c)
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
        key: g.key,
        nombre: g.nombre,
        mostrador: !!g.mostrador,
        suelto: !!g.suelto,
        referencia: g.referencia || '',
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
        key: g.key,
        nombre: g.nombre,
        mostrador: !!g.mostrador,
        suelto: !!g.suelto,
        referencia: g.referencia || '',
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

// Cobra o revierte el pago de una cuenta, sin tocar otros cobros suyos.
// Al cobrar (pagado=true) marca solo las líneas todavía pendientes con `medio`.
// Al revertir (pagado=false) afecta solo las líneas cobradas con ese `medio`.
//
// `cuenta` es una de las que devuelve buildCuentas: la de un jugador afecta sus
// líneas por nombre, y la de mostrador solo la venta suelta que la originó.
export function aplicarPago(planilla, cuenta, medio, pagado) {
  const objetivo = (cuenta?.nombre || '').trim()
  const idsSueltos = new Set((cuenta?.consumos || []).map((c) => c.id))
  const esSuelto = (item) => !!item?.mostrador || item?.parte?.de > 1
  const pertenece = cuenta?.suelto
    ? (item) => esSuelto(item) && !(item.jugador || '').trim() && idsSueltos.has(item.id)
    : // Sin esto, la cuenta "Sin asignar" (jugador vacío) se llevaría también los
      // consumos sueltos, que no tienen nombre a propósito y se cobran uno a uno.
      (item) =>
        !(esSuelto(item) && !(item.jugador || '').trim()) &&
        (item?.jugador || '').trim() === objetivo
  const afecta = pagado
    ? (item) => pertenece(item) && !item.pagado
    : (item) => pertenece(item) && item.pagado && item.pago === medio
  const aplicar = (item) =>
    afecta(item)
      ? pagado
        ? { ...item, pagado: true, pago: medio }
        : { ...item, pagado: false, pago: null }
      : item

  // En un turno de reserva no se marca una línea como pagada: se le agrega un
  // pago por lo que falta (o se le sacan los pagos de esa persona al revertir),
  // que es como se cobra desde la planilla.
  const aplicarTurno = (t) => {
    if (!tienePagos(t)) return aplicar(t)
    if (pagado) {
      const falta = saldoTurno(t)
      if (!pertenece(t) || falta <= 0) return t
      return agregarPago(t, { nombre: t.jugador, monto: falta, pago: medio })
    }
    const quedan = pagosDe(t).filter(
      (p) => p.pago !== medio || ((p.nombre || '').trim() || (t.jugador || '').trim()) !== objetivo,
    )
    return quedan.length === pagosDe(t).length ? t : { ...t, pagos: quedan }
  }

  const turnos = {}
  for (const [key, lista] of Object.entries(planilla.turnos || {})) {
    turnos[key] = lista.map(aplicarTurno)
  }
  const consumos = (planilla.consumos || []).map(aplicar)

  return { ...planilla, turnos, consumos }
}

export { turnoKey }
