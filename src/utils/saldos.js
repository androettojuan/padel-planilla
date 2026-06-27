import { normalizeNombre } from './helpers'

// Recorre todas las planillas y junta las líneas cobradas como "Anotado" (es
// decir, fiadas): turnos, consumos y consumos de mostrador. Devuelve un cargo
// por línea, con la persona normalizada para poder agrupar.
export function cargosFiado(planillas) {
  const out = []
  const push = (dateKey, monto, pagado, pago, nombre, concepto) => {
    if (!(monto > 0)) return
    if (!pagado || pago !== 'anotado') return
    const disp = (nombre || '').trim() || 'Sin nombre'
    out.push({ dateKey, monto, nombre: disp, nombreKey: normalizeNombre(disp), concepto })
  }
  for (const { dateKey, data } of planillas) {
    for (const lista of Object.values(data?.turnos || {})) {
      for (const t of lista) push(dateKey, Number(t.monto) || 0, t.pagado, t.pago, t.jugador, 'Turno')
    }
    for (const c of data?.consumos || []) {
      const sub = (Number(c.precio) || 0) * (Number(c.cantidad) || 0)
      push(dateKey, sub, c.pagado, c.pago, c.jugador, c.nombre)
    }
    for (const tab of data?.mostrador || []) {
      for (const it of tab.items || []) {
        const sub = (Number(it.precio) || 0) * (Number(it.cantidad) || 0)
        push(dateKey, sub, tab.pagado, tab.pago, tab.nombre, it.nombre)
      }
    }
  }
  return out
}

/**
 * Calcula el saldo de fiado por persona: lo anotado (cargos) menos los pagos de
 * fiado registrados. Agrupa por nombre normalizado (ignora mayúsculas, acentos
 * y comas) y, si el nombre coincide con uno del directorio, lo usa para mostrar.
 *
 * `cargosManuales` son deudas cargadas a mano (paso del papel al sistema); se
 * suman igual que lo anotado en planillas, pero quedan marcadas (manual + id)
 * para poder borrarlas.
 *
 * `cortes` son liquidaciones: cuando una cuenta se saldó por completo se borran
 * sus pagos y cargos manuales, pero los anotados en planillas no se pueden
 * borrar. El corte guarda `montoPlanilla` (lo anotado ya archivado) y acá se
 * descuenta de los cargos de planilla del más viejo al más nuevo, así esos
 * cargos viejos dejan de sumar al saldo y la cuenta arranca de 0.
 *
 * Devuelve { saldos, totalDeuda }, ordenado alfabéticamente. Cada saldo:
 * { nombreKey, nombre, cargos, pagos, totalCargos, totalPagos, saldo }.
 */
export function buildSaldos(planillas, fiadoPagos = [], jugadores = [], cargosManuales = [], cortes = []) {
  const map = new Map()
  const get = (key, nombre) => {
    if (!map.has(key)) {
      map.set(key, { nombreKey: key, nombre, cargos: [], pagos: [], totalCargos: 0, totalPagos: 0 })
    }
    return map.get(key)
  }

  for (const c of cargosFiado(planillas)) {
    const g = get(c.nombreKey, c.nombre)
    g.cargos.push(c)
    g.totalCargos += c.monto
  }
  for (const c of cargosManuales) {
    const disp = (c.nombre || '').trim() || 'Sin nombre'
    const key = c.nombreKey || normalizeNombre(disp)
    const monto = Number(c.monto) || 0
    const g = get(key, disp)
    g.cargos.push({
      id: c.id,
      manual: true,
      dateKey: c.fecha,
      monto,
      nombre: disp,
      nombreKey: key,
      concepto: c.concepto || 'Fiado',
    })
    g.totalCargos += monto
  }
  for (const p of fiadoPagos) {
    const key = p.nombreKey || normalizeNombre(p.nombre)
    const g = get(key, (p.nombre || '').trim() || 'Sin nombre')
    g.pagos.push(p)
    g.totalPagos += Number(p.monto) || 0
  }

  // Nombre a mostrar: el del directorio si coincide, si no el del último cargo.
  const dirByKey = new Map()
  for (const j of jugadores) {
    const k = normalizeNombre(j.nombre)
    if (k) dirByKey.set(k, (j.nombre || '').trim())
  }

  // Monto anotado ya archivado por persona (liquidaciones).
  const corteByKey = new Map()
  for (const ct of cortes) {
    const key = ct.nombreKey || normalizeNombre(ct.nombre)
    if (key) corteByKey.set(key, Number(ct.montoPlanilla) || 0)
  }

  const saldos = []
  for (const g of map.values()) {
    g.cargos.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    g.pagos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

    // Descontamos el corte de los cargos de planilla (no manuales), del más
    // viejo al más nuevo: los totalmente archivados se quitan y el del borde
    // queda con lo que reste.
    let corte = corteByKey.get(g.nombreKey) || 0
    if (corte > 0) {
      const cargos = []
      for (const c of g.cargos) {
        if (c.manual || corte <= 0) {
          cargos.push(c)
        } else if (corte >= c.monto) {
          corte -= c.monto // cargo archivado: no se muestra
        } else {
          cargos.push({ ...c, monto: c.monto - corte })
          corte = 0
        }
      }
      g.cargos = cargos
      g.totalCargos = cargos.reduce((s, c) => s + c.monto, 0)
    }

    saldos.push({
      ...g,
      nombre: dirByKey.get(g.nombreKey) || g.nombre,
      saldo: g.totalCargos - g.totalPagos,
    })
  }
  saldos.sort((a, b) => a.nombre.localeCompare(b.nombre))

  const totalDeuda = saldos.reduce((s, x) => s + Math.max(0, x.saldo), 0)
  return { saldos, totalDeuda }
}
