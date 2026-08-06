// Agrega todas las planillas de un mes: lo que se vendió, cobrado o no —contado,
// mercado, anotado (lo que quedó fiado) y pendiente—, más los pagos de fiado que
// entraron en el mes, que se informan aparte.
//
// Un pago de fiado NO se resta del anotado del mes. Antes sí, y por eso el
// anotado podía quedar en $0 o en negativo mientras su propio detalle listaba
// cargos: dos números que se contradecían. Ahora cada cosa se cuenta una sola vez
// y en un solo lugar.

import { lineasDePlanilla } from './planilla'

const PAGO_IDS = ['contado', 'mercado', 'anotado']

export function resumenMensual(planillas, fiadoPagos = []) {
  const acc = { contado: 0, mercado: 0, anotado: 0, pendiente: 0, total: 0 }
  const porDiaMap = new Map()
  const anotadoDetalle = []
  const fiadoCobrado = { contado: 0, mercado: 0, total: 0 }
  const fiadoCobradoDetalle = []
  // Consumos vendidos y lo que costó esa mercadería, para la ganancia del mes. El
  // costo sale de cada línea (el del día de la venta); las líneas cargadas antes
  // de que existiera el stock no lo tienen y quedan sin costo.
  const consumos = { venta: 0, costo: 0, conCosto: 0, sinCosto: 0 }

  const dia = (dateKey) => {
    if (!porDiaMap.has(dateKey)) {
      porDiaMap.set(dateKey, { dateKey, contado: 0, mercado: 0, anotado: 0, pendiente: 0, total: 0 })
    }
    return porDiaMap.get(dateKey)
  }

  const registrar = (dateKey, { monto, pagado, pago, nombre, concepto }) => {
    if (!(monto > 0)) return
    const d = dia(dateKey)
    acc.total += monto
    d.total += monto
    if (pagado && PAGO_IDS.includes(pago)) {
      acc[pago] += monto
      d[pago] += monto
      if (pago === 'anotado') {
        anotadoDetalle.push({ dateKey, nombre: (nombre || '').trim() || 'Sin nombre', concepto, monto })
      }
    } else {
      acc.pendiente += monto
      d.pendiente += monto
    }
  }

  for (const { dateKey, data } of planillas) {
    for (const linea of lineasDePlanilla(data)) {
      registrar(dateKey, linea)
      // Lo vendido en mercadería y lo que costó, para la ganancia del mes. Las
      // cuentas viejas de mostrador no traen costo y quedan afuera.
      const c = linea.consumo
      if (!c || !(linea.monto > 0)) continue
      consumos.venta += linea.monto
      consumos.costo += (Number(c.costo) || 0) * (Number(c.cantidad) || 0)
      if (c.costo === undefined || c.costo === null) consumos.sinCosto += linea.monto
      else consumos.conCosto += linea.monto
    }
  }

  // Pagos de fiado cobrados este mes. Son plata que entra, pero NO facturación
  // nueva —lo facturado fue el día que se anotó, tal vez meses atrás—, así que
  // suman a la caja y no tocan ni el total ni el desglose por día.
  for (const p of fiadoPagos) {
    const monto = Number(p.monto) || 0
    if (!(monto > 0)) continue
    const medio = p.medio === 'contado' || p.medio === 'mercado' ? p.medio : null
    if (!medio) continue // un fiado no se salda con "anotado"
    fiadoCobrado[medio] += monto
    fiadoCobrado.total += monto
    fiadoCobradoDetalle.push({
      dateKey: p.fecha || '',
      nombre: (p.nombre || '').trim() || 'Sin nombre',
      medio,
      monto,
    })
  }

  const porDia = [...porDiaMap.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  anotadoDetalle.sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || a.nombre.localeCompare(b.nombre),
  )
  fiadoCobradoDetalle.sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || a.nombre.localeCompare(b.nombre),
  )

  return {
    ...acc,
    porDia,
    anotadoDetalle,
    fiadoCobrado,
    fiadoCobradoDetalle,
    consumos: {
      ...consumos,
      ganancia: consumos.venta - consumos.costo,
      // Sin una sola venta con costo cargado no hay ganancia que mostrar: sería
      // igual a lo vendido y daría a entender que la mercadería salió gratis.
      hayCosto: consumos.conCosto > 0,
    },
  }
}
