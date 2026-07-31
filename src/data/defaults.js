// Configuración por defecto del club. Se usa como semilla cuando todavía no
// existe el documento config/club en Firestore, y también como fallback cuando
// la app corre sin Firebase configurado (modo demo / localStorage).
import { uid } from '../utils/helpers'

export const PAGOS = [
  { id: 'contado', label: 'Contado', short: 'CONT', color: '#16a34a' },
  { id: 'mercado', label: 'Mercado Pago', short: 'MERC', color: '#2563eb' },
  { id: 'anotado', label: 'Anotado', short: 'ANOT', color: '#f59e0b' },
]

export const PAGOS_BY_ID = Object.fromEntries(PAGOS.map((p) => [p.id, p]))

// El nombre y la ubicación del club no están acá: viven en clubs/{clubId},
// porque la app maneja varios clubes y cada uno tiene su propia configuración.
export const DEFAULT_CONFIG = {
  canchas: [
    { id: 'c1', nombre: 'Cancha 1' },
    { id: 'c2', nombre: 'Cancha 2' },
  ],
  // Sin `regla`: la configuración la deduce de las franjas con `reglaDeFranjas`.
  // Ponerla acá se la impondría a todos los clubes que todavía no la guardaron,
  // porque la config se lee mezclada con estos valores por defecto.
  horarios: [
    { id: 'h1', desde: '14:00', hasta: '15:30' },
    { id: 'h2', desde: '15:30', hasta: '17:00' },
    { id: 'h3', desde: '17:00', hasta: '18:30' },
    { id: 'h4', desde: '18:30', hasta: '20:00' },
    { id: 'h5', desde: '20:00', hasta: '21:30' },
    { id: 'h6', desde: '21:30', hasta: '23:00' },
    { id: 'h7', desde: '22:30', hasta: '24:00' },
  ],
  productos: [
    { id: 'p1', nombre: 'Cerveza', precio: 6000 },
    { id: 'p2', nombre: 'Power grande', precio: 5000 },
    { id: 'p3', nombre: 'Power chico', precio: 3000 },
    { id: 'p4', nombre: 'Agua', precio: 2000 },
    { id: 'p5', nombre: 'Gatorade', precio: 4000 },
    { id: 'p6', nombre: 'Alquiler paletas', precio: 3000 },
    { id: 'p7', nombre: 'Tubo de pelotas', precio: 12000 },
  ],
  // Alias o CBU donde el club recibe transferencias. Va en la boleta de fiado,
  // que es lo que se le manda a quien tiene que pagar.
  alias: '',
}

// Etiqueta legible de una franja. Soporta el formato nuevo (desde/hasta) y el
// viejo (label) por compatibilidad con datos ya guardados.
export function horarioLabel(h) {
  if (!h) return ''
  if (h.desde || h.hasta) return `${h.desde || '?'} a ${h.hasta || '?'}`
  return h.label || ''
}

// ---------------------------------------------------------------------------
// Franjas horarias
//
// El club tiene una lista de franjas y, opcionalmente, cada cancha la suya
// (`cancha.horarios`). Una cancha sin lista propia usa la del club. Encima de
// eso, tanto el club como cada cancha pueden tener un horario distinto para
// cierto día de la semana (`horariosByDow`).
// ---------------------------------------------------------------------------

const HHMM = /^(\d{1,2}):(\d{2})$/
// Minutos desde medianoche; null si la hora está vacía o mal escrita.
export function minutosDe(hora) {
  const m = HHMM.exec(String(hora || '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
const horaDe = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

/**
 * Genera las franjas de `desde` a `hasta` en turnos de `duracion` minutos.
 *
 * Reusa el id de las franjas que ya existían con el mismo rango: los turnos
 * cargados se guardan como `canchaId__horarioId`, así que regenerar con ids
 * nuevos dejaría esos turnos apuntando a franjas que ya no están.
 */
export function generarFranjas({ desde, hasta, duracion } = {}, existentes = []) {
  const ini = minutosDe(desde)
  let fin = minutosDe(hasta)
  const paso = Number(duracion) || 0
  if (ini === null || fin === null || paso <= 0) return []
  // "00:00" como cierre se lee como medianoche del día siguiente.
  if (fin <= ini) fin += 24 * 60
  const idPrevio = new Map((existentes || []).map((h) => [`${h.desde}|${h.hasta}`, h.id]))

  const out = []
  for (let t = ini; t + paso <= fin; t += paso) {
    const franja = { desde: horaDe(t % (24 * 60)), hasta: horaDe((t + paso) % (24 * 60)) }
    out.push({ id: idPrevio.get(`${franja.desde}|${franja.hasta}`) || uid(), ...franja })
  }
  return out
}

// Deduce una regla mirando las franjas ya cargadas, para clubes configurados
// antes de que existiera la regla (o listas editadas a mano).
export function reglaDeFranjas(horarios = []) {
  const lista = horarios.filter((h) => minutosDe(h.desde) !== null)
  if (!lista.length) return { desde: '', hasta: '', duracion: 90 }
  const primero = lista[0]
  const ultimo = lista[lista.length - 1]
  const dur = minutosDe(primero.hasta) - minutosDe(primero.desde)
  return {
    desde: primero.desde,
    hasta: ultimo.hasta,
    duracion: dur > 0 ? dur : 90,
  }
}

// Lista efectiva de un "dueño" (el club o una cancha) para una fecha: si ese
// día de la semana tiene override se usa ese, si no la lista base.
// dow: 0=domingo … 6=sábado (Date.getDay()).
function horariosDe(duenio, dateKey) {
  const byDow = duenio?.horariosByDow
  if (byDow && dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (Array.isArray(byDow[dow])) return byDow[dow]
  }
  return duenio?.horarios || []
}

// Franjas del club para esa fecha.
export function horariosForDate(config, dateKey) {
  return horariosDe(config, dateKey)
}

// Franjas de una cancha para esa fecha: las propias si tiene, si no las del club.
export function horariosDeCancha(config, dateKey, cancha) {
  if (Array.isArray(cancha?.horarios)) return horariosDe(cancha, dateKey)
  return horariosForDate(config, dateKey)
}

/**
 * Busca una franja por id para etiquetar un turno ya guardado. Mira todas las
 * listas donde puede estar: las de la cancha (incluidos sus días propios) y las
 * del club. Sirve para turnos viejos, de días con horario distinto o de franjas
 * que después se borraron de la lista activa.
 */
export function buscarFranja(config, canchaId, horarioId) {
  const cancha = (config?.canchas || []).find((c) => c.id === canchaId)
  const listas = [
    cancha?.horarios,
    ...Object.values(cancha?.horariosByDow || {}),
    config?.horarios,
    ...Object.values(config?.horariosByDow || {}),
  ]
  for (const lista of listas) {
    const franja = Array.isArray(lista) && lista.find((h) => h.id === horarioId)
    if (franja) return franja
  }
  return null
}

/**
 * Agrupa las canchas por horario para armar el tablero.
 *
 * Las canchas que comparten las mismas franjas van juntas y comparten una única
 * columna de horarios, así cada grupo es una tabla pareja. Un club donde las
 * canchas 1 y 3 abren de 14 a 23 y las 2 y 4 de 18 a 24 se ve como dos tablas
 * lado a lado, en vez de una sola con la mitad de las celdas vacías.
 *
 *   grupos: [{ key, franjas: [...], canchas: [{ cancha, franjas }] }]
 *
 * `franjas` del grupo es la lista que rotula las filas; la de cada cancha tiene
 * los mismos horarios pero con sus propios ids, que son los que llevan los
 * turnos guardados. En el caso normal —todas con el horario del club— hay un
 * solo grupo y el tablero queda igual que siempre.
 */
export function ejeHorarios(config, dateKey) {
  const grupos = []
  const porFirma = new Map()

  for (const cancha of config?.canchas || []) {
    const franjas = horariosDeCancha(config, dateKey, cancha)
    // Dos canchas comparten grupo si sus franjas son las mismas horas, aunque
    // cada una las tenga con ids distintos.
    const firma = franjas.map((h) => `${h.desde || ''}-${h.hasta || ''}`).join('|')
    if (!porFirma.has(firma)) {
      const grupo = { key: `g${grupos.length}`, franjas, canchas: [] }
      porFirma.set(firma, grupo)
      grupos.push(grupo)
    }
    porFirma.get(firma).canchas.push({ cancha, franjas })
  }

  return { grupos }
}

export function emptyPlanilla() {
  // El medio de pago (`pago`) y `pagado` se fijan al confirmar la cuenta del
  // jugador; mientras la cuenta está pendiente esas líneas tienen pagado=false.
  // turnos: { [`${canchaId}__${horarioId}`]: [{ id, jugador, monto, pagado, pago }] }
  // consumos: [{ id, jugador, productoId, nombre, cantidad, precio, pagado, pago }]
  // mostrador: cuentas de gente que no juega (bar/mostrador), con su propio cobro.
  //   [{ id, nombre, items: [{ id, productoId, nombre, precio, cantidad }], pagado, pago }]
  return { turnos: {}, consumos: [], mostrador: [] }
}

export const turnoKey = (canchaId, horarioId) => `${canchaId}__${horarioId}`
