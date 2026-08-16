// Arma la lista de gastos de un mes cruzando la plantilla (qué se paga todos los
// meses) con los pagos cargados (qué se pagó de verdad en ese mes).
//
// La lista también incluye los pagos huérfanos: un gasto que se pagó y después se
// sacó de la plantilla sigue apareciendo en los meses donde se pagó, porque esa
// plata salió igual y el total del mes tiene que cerrar.

const norm = (g) => ({ ...g, monto: Number(g.monto) || 0 })

export function gastosDelMes(gastosFijos = [], pagos = []) {
  const pagoPorGasto = new Map()
  for (const p of pagos) pagoPorGasto.set(p.gastoId, p)

  const filas = gastosFijos
    .filter((g) => g.activo !== false)
    .map(norm)
    .map((g) => {
      const pago = pagoPorGasto.get(g.id) || null
      return {
        id: g.id,
        nombre: g.nombre || '',
        montoRef: g.monto,
        pago,
        // Lo que cuenta en el mes: lo pagado si ya se pagó, si no la referencia.
        monto: pago ? Number(pago.monto) || 0 : g.monto,
        pagado: !!pago,
        enPlantilla: true,
      }
    })

  const enPlantilla = new Set(filas.map((f) => f.id))
  for (const p of pagos) {
    if (enPlantilla.has(p.gastoId)) continue
    filas.push({
      id: p.gastoId,
      nombre: p.nombre || 'Gasto sin nombre',
      montoRef: 0,
      pago: p,
      monto: Number(p.monto) || 0,
      pagado: true,
      enPlantilla: false,
    })
  }

  filas.sort((a, b) => a.nombre.localeCompare(b.nombre))

  const pagado = filas.filter((f) => f.pagado).reduce((s, f) => s + f.monto, 0)
  const pendiente = filas.filter((f) => !f.pagado).reduce((s, f) => s + f.monto, 0)

  return { filas, pagado, pendiente, total: pagado + pendiente }
}

// Total pagado en un mes, para el resumen mensual.
export const totalPagado = (pagos = []) => pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)
