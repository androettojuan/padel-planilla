import { conceptoConsumo, nombreConsumo } from './consumos'
import { lineasDeTurno } from './turnos'

/**
 * Todo lo facturado en una planilla, como una sola lista de líneas parejas:
 *
 *   { monto, pagado, pago, nombre, concepto, consumo? }
 *
 * Es el único lugar que sabe de qué está hecha una planilla —turnos (que en el
 * modo reserva se abren en una línea por pago), consumos y las cuentas viejas de
 * mostrador—, para que los totales del día, el resumen del mes y los fiados sean
 * cada uno un recorrido sobre esta lista. Antes los tres repetían la misma vuelta
 * y cada concepto nuevo había que acordarse de sumarlo en los tres.
 *
 * `consumo` viene solo en las líneas que salen de un consumo, para lo que
 * necesita mirar el producto en sí (el costo con el que entró, por ejemplo).
 */
export function lineasDePlanilla(planilla) {
  const out = []

  for (const lista of Object.values(planilla?.turnos || {})) {
    for (const turno of lista) {
      for (const l of lineasDeTurno(turno)) {
        out.push({
          monto: l.monto,
          pagado: l.pagado,
          pago: l.pago,
          nombre: l.jugador,
          concepto: 'Turno',
        })
      }
    }
  }

  for (const c of planilla?.consumos || []) {
    out.push({
      monto: (Number(c.precio) || 0) * (Number(c.cantidad) || 0),
      pagado: !!c.pagado,
      pago: c.pago,
      nombre: nombreConsumo(c),
      concepto: conceptoConsumo(c),
      consumo: c,
    })
  }

  // Cuentas de mostrador del modelo viejo: una pestaña con varios ítems y el
  // estado de pago en la pestaña, no en cada ítem. Ya no se crean —una venta de
  // mostrador es hoy una línea de consumo—, pero las planillas cargadas antes
  // las siguen teniendo y tienen que seguir sumando igual.
  for (const tab of planilla?.mostrador || []) {
    for (const it of tab.items || []) {
      out.push({
        monto: (Number(it.precio) || 0) * (Number(it.cantidad) || 0),
        pagado: !!tab.pagado,
        pago: tab.pago,
        nombre: tab.nombre,
        concepto: it.nombre,
      })
    }
  }

  return out
}
