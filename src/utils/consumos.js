import { normalizeNombre, uid } from './helpers'

// Con quién se anota una venta a alguien que no estaba jugando.
export const MOSTRADOR_LABEL = 'Mostrador'

// Un consumo dividido entre varios jugadores no es una línea especial: son
// varias líneas normales, una por jugador, con su parte del precio. Así cada
// jugador lo ve en su propia cuenta, lo paga con el medio que quiera y suma
// igual en los totales, el resumen del mes y los saldos, sin que nada de eso
// tenga que saber que el producto estuvo compartido.
//
// Las partes de un mismo producto comparten `grupoId` y llevan `parte`
// ({ n, de }) para poder mostrar "1/3" y volver a dividirlo después.

/**
 * Reparte un monto entero en `partes` partes lo más parejas posible. El resto de
 * la división (unos pocos pesos) se le suma a las primeras, así la suma de las
 * partes siempre da el total exacto y no se pierde plata por redondeo.
 *
 *   repartirMonto(12000, 3) → [4000, 4000, 4000]
 *   repartirMonto(5000, 3)  → [1667, 1667, 1666]
 */
export function repartirMonto(total, partes) {
  const n = Math.max(1, Math.floor(partes) || 1)
  const t = Math.max(0, Math.round(Number(total) || 0))
  const base = Math.floor(t / n)
  const resto = t - base * n
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0))
}

// Limpia la lista de jugadores: saca vacíos y repetidos (mismo nombre escrito
// distinto cuenta como uno solo), conservando el orden en que se cargaron.
export function nombresUnicos(nombres = []) {
  const vistos = new Set()
  const out = []
  for (const raw of nombres) {
    const nombre = (raw || '').trim()
    if (!nombre) continue
    const key = normalizeNombre(nombre)
    if (!key || vistos.has(key)) continue
    vistos.add(key)
    out.push(nombre)
  }
  return out
}

/**
 * Líneas de consumo para un producto cargado a uno o varios jugadores. Con un
 * solo jugador devuelve la línea de siempre (sin grupo ni parte); con varios,
 * una línea por jugador con el precio repartido.
 */
export function lineasConsumo(
  { productoId, nombre, precio, costo = 0 },
  nombres,
  cantidad = 1,
  partes = 0,
) {
  const lista = nombresUnicos(nombres)
  // Se puede dividir sin decir entre quiénes: en los clubes que solo anotan al
  // que reserva, poner nombres para partir una cerveza es trabajo al pedo. Las
  // partes sin nombre se cobran igual, cada una por su lado.
  const total = Math.max(lista.length, Math.floor(Number(partes) || 0))
  if (total < 1) return []
  const qty = Math.max(1, Number(cantidad) || 1)
  const base = { productoId, nombre, cantidad: qty, pagado: false }

  if (total === 1) {
    return [
      {
        id: uid(),
        jugador: lista[0] || '',
        ...base,
        precio: Math.round(Number(precio) || 0),
        costo: Math.round(Number(costo) || 0),
      },
    ]
  }

  // El costo se reparte igual que el precio, así sumando las partes vuelve a dar
  // el costo del producto entero y la ganancia del mes no se cuenta de más.
  const montos = repartirMonto(precio, total)
  const costos = repartirMonto(costo, total)
  const grupoId = uid()
  return Array.from({ length: total }, (_, i) => ({
    id: uid(),
    jugador: lista[i] || '',
    ...base,
    precio: montos[i],
    costo: costos[i],
    grupoId,
    parte: { n: i + 1, de: total },
  }))
}

/**
 * Líneas de un consumo recién cargado, que es donde se decide qué clase de venta
 * es: sin nombres y sin dividir, quien se lo llevó no estaba jugando, así que va
 * como venta de mostrador. Con nombres o partido, son líneas de consumo normales.
 */
export function lineasNuevoConsumo(base, nombres, cantidad = 1, partes = 0) {
  const lista = nombresUnicos(nombres)
  const total = Math.max(lista.length, Math.floor(Number(partes) || 0))
  if (!lista.length && total <= 1) return [lineaMostrador(base, cantidad)]
  return lineasConsumo(base, lista, cantidad, total)
}

/**
 * Consumo de alguien que no estaba jugando: una venta suelta del mostrador. Va
 * sin jugador a propósito y marcado con `mostrador`, para distinguirlo de un
 * consumo al que le falta el nombre. Cada uno se cobra por separado.
 */
function lineaMostrador({ productoId, nombre, precio, costo = 0 }, cantidad = 1) {
  return {
    id: uid(),
    jugador: '',
    mostrador: true,
    productoId,
    nombre,
    precio: Math.round(Number(precio) || 0),
    costo: Math.round(Number(costo) || 0),
    cantidad: Math.max(1, Number(cantidad) || 1),
    pagado: false,
  }
}

// Las líneas que comparten la división de un mismo producto. Una línea sin
// dividir es un grupo de uno. Recorre la lista entera, así que conviene pedirlo
// una vez por consumo y derivar de ahí lo demás (jugadores, dueño, precio).
export function grupoDe(consumos = [], consumo) {
  if (!consumo) return []
  if (!consumo.grupoId) return [consumo]
  return consumos.filter((c) => c.grupoId === consumo.grupoId)
}

/**
 * Un consumo "suelto" es el que no tiene a quién cobrarle por nombre: una venta
 * de mostrador, o la parte de algo dividido sin decir entre quiénes. Cada uno se
 * cobra por su lado, porque nadie sabe si son de la misma persona.
 */
export const esConsumoSuelto = (consumo) =>
  !(consumo?.jugador || '').trim() && (!!consumo?.mostrador || consumo?.parte?.de > 1)

// Las partes de un producto compartido en el orden en que se dividió.
const ordenarPartes = (grupo) =>
  grupo.slice().sort((a, b) => (a.parte?.n || 0) - (b.parte?.n || 0))

// Jugadores entre los que está dividido el producto, en orden de parte.
export const jugadoresDeGrupo = (grupo = []) => ordenarPartes(grupo).map((c) => c.jugador)

/**
 * A nombre de quién está el producto compartido: el primero de sus partes que
 * tenga nombre. Sirve para que las partes sin nombre no queden huérfanas —"esta
 * cerveza es la de Juan"— aunque cada una se cobre por separado.
 */
export const duenioDeGrupo = (grupo = []) =>
  (jugadoresDeGrupo(grupo).find((n) => (n || '').trim()) || '').trim()

// Precio unitario del producto entero: la suma de las partes del grupo.
export const precioDeGrupo = (grupo = []) =>
  grupo.reduce((s, c) => s + (Number(c.precio) || 0), 0)

// Costo con el que entró la mercadería del producto entero, repartido igual que
// el precio entre sus partes.
export const costoDeGrupo = (grupo = []) =>
  grupo.reduce((s, c) => s + (Number(c.costo) || 0), 0)

// Nombre que lleva el consumo en el resumen del mes y en el detalle de fiado.
export function nombreConsumo(consumo) {
  return consumo?.mostrador ? MOSTRADOR_LABEL : consumo?.jugador
}

// Etiqueta del consumo con la parte, para el detalle de fiado y el resumen:
// "Tubo de pelotas (1/3)".
export function conceptoConsumo(consumo) {
  const nombre = consumo?.nombre || 'Consumo'
  const parte = consumo?.parte
  return parte?.de > 1 ? `${nombre} (${parte.n}/${parte.de})` : nombre
}

/**
 * Reemplaza un consumo (o el grupo del que forma parte) por una división nueva
 * entre `nombres`. Sirve tanto para dividir algo que se había cargado a un solo
 * jugador como para cambiar entre quiénes se reparte. El precio del producto no
 * cambia: se vuelve a repartir el total del grupo.
 */
export function redividirConsumo(planilla, consumo, nombres, partes = 0) {
  const consumos = planilla?.consumos || []
  const grupo = grupoDe(consumos, consumo)
  if (!grupo.length) return planilla
  // Si alguna parte ya se cobró, el reparto no se toca: cambiarlo reabriría una
  // cuenta cerrada. Primero hay que revertir ese pago.
  if (grupo.some((c) => c.pagado)) return planilla

  const nuevas = lineasConsumo(
    {
      productoId: consumo.productoId,
      nombre: consumo.nombre,
      precio: precioDeGrupo(grupo),
      // El costo con el que entró la mercadería se conserva: es el del día en que
      // se cargó la venta, no el de la última compra.
      costo: costoDeGrupo(grupo),
    },
    nombres,
    consumo.cantidad,
    partes,
  )
  if (!nuevas.length) return planilla

  // Las nuevas partes quedan donde estaba la primera del grupo, para que la
  // lista no se reordene al dividir.
  const ids = new Set(grupo.map((c) => c.id))
  const out = []
  let puestas = false
  for (const c of consumos) {
    if (!ids.has(c.id)) {
      out.push(c)
    } else if (!puestas) {
      out.push(...nuevas)
      puestas = true
    }
  }
  return { ...planilla, consumos: out }
}

// La cantidad de un producto dividido se cambia de una vez para todas sus
// partes: son unidades del mismo producto, no de cada jugador. Las partes ya
// cobradas quedan como están, para no alterar un pago cerrado.
export function setCantidadConsumo(planilla, consumo, cantidad) {
  const qty = Math.max(1, Number(cantidad) || 1)
  const ids = new Set(
    grupoDe(planilla?.consumos || [], consumo)
      .filter((c) => !c.pagado)
      .map((c) => c.id),
  )
  return {
    ...planilla,
    consumos: (planilla?.consumos || []).map((c) => (ids.has(c.id) ? { ...c, cantidad: qty } : c)),
  }
}
