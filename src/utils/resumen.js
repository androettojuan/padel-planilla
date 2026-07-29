// Agrega todas las planillas de un mes en totales por medio de pago, con el
// desglose por día y el detalle de lo anotado (lo que quedó "fiado").
//
// Solo las líneas confirmadas (pagado) tienen medio de pago; lo no cobrado se
// acumula como "pendiente". `total` es lo facturado en el mes.
//
// Además recibe los pagos de fiado del mes (`fiadoPagos`, filtrados por fecha de
// pago): cada pago es plata que entró este mes por su medio (contado/mercado),
// así que se SUMA a ese medio y se RESTA de anotado (deja de estar fiado). Como
// un pago puede saldar deuda anotada en meses anteriores, el anotado del mes
// puede quedar negativo (se cobró más fiado viejo del que se anotó nuevo); por
// eso se devuelve `fiadoCobrado` para poder explicarlo en la UI.

import { conceptoConsumo, nombreConsumo } from './consumos'

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

  const registrar = (dateKey, monto, pagado, pago, nombre, concepto) => {
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
    for (const lista of Object.values(data?.turnos || {})) {
      for (const t of lista) {
        registrar(dateKey, Number(t.monto) || 0, t.pagado, t.pago, t.jugador, 'Turno')
      }
    }
    for (const c of data?.consumos || []) {
      const cantidad = Number(c.cantidad) || 0
      const sub = (Number(c.precio) || 0) * cantidad
      registrar(dateKey, sub, c.pagado, c.pago, nombreConsumo(c), conceptoConsumo(c))
      if (sub > 0) {
        consumos.venta += sub
        const costo = (Number(c.costo) || 0) * cantidad
        consumos.costo += costo
        if (c.costo === undefined || c.costo === null) consumos.sinCosto += sub
        else consumos.conCosto += sub
      }
    }
    for (const tab of data?.mostrador || []) {
      for (const it of tab.items || []) {
        const sub = (Number(it.precio) || 0) * (Number(it.cantidad) || 0)
        registrar(dateKey, sub, tab.pagado, tab.pago, tab.nombre, it.nombre)
      }
    }
  }

  // Pagos de fiado cobrados este mes: mueven plata de anotado al medio real.
  for (const p of fiadoPagos) {
    const monto = Number(p.monto) || 0
    if (!(monto > 0)) continue
    const medio = p.medio === 'contado' || p.medio === 'mercado' ? p.medio : null
    if (!medio) continue // un fiado no se salda con "anotado"
    const dateKey = p.fecha || ''
    acc[medio] += monto
    acc.anotado -= monto
    if (dateKey) {
      const d = dia(dateKey)
      d[medio] += monto
      d.anotado -= monto
      // No tocamos d.total ni acc.total: un pago no es facturación nueva, solo
      // reclasifica plata ya facturada de anotado al medio con que se cobró.
    }
    fiadoCobrado[medio] += monto
    fiadoCobrado.total += monto
    fiadoCobradoDetalle.push({ dateKey, nombre: (p.nombre || '').trim() || 'Sin nombre', medio, monto })
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
    cobrado: acc.contado + acc.mercado + acc.anotado,
    porDia,
    anotadoDetalle,
    fiadoCobrado,
    fiadoCobradoDetalle,
    consumos: { ...consumos, ganancia: consumos.venta - consumos.costo },
  }
}
