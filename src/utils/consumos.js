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
export function lineasConsumo({ productoId, nombre, precio, costo = 0 }, nombres, cantidad = 1) {
  const lista = nombresUnicos(nombres)
  if (!lista.length) return []
  const qty = Math.max(1, Number(cantidad) || 1)
  const base = { productoId, nombre, cantidad: qty, pagado: false }

  if (lista.length === 1) {
    return [
      {
        id: uid(),
        jugador: lista[0],
        ...base,
        precio: Math.round(Number(precio) || 0),
        costo: Math.round(Number(costo) || 0),
      },
    ]
  }

  // El costo se reparte igual que el precio, así sumando las partes vuelve a dar
  // el costo del producto entero y la ganancia del mes no se cuenta de más.
  const partes = repartirMonto(precio, lista.length)
  const costos = repartirMonto(costo, lista.length)
  const grupoId = uid()
  return lista.map((jugador, i) => ({
    id: uid(),
    jugador,
    ...base,
    precio: partes[i],
    costo: costos[i],
    grupoId,
    parte: { n: i + 1, de: lista.length },
  }))
}

/**
 * Consumo de alguien que no estaba jugando: una venta suelta del mostrador. Va
 * sin jugador a propósito y marcado con `mostrador`, para distinguirlo de un
 * consumo al que le falta el nombre. Cada uno se cobra por separado.
 */
export function lineaMostrador({ productoId, nombre, precio, costo = 0 }, cantidad = 1) {
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
// dividir es un grupo de uno.
export function grupoDe(consumos = [], consumo) {
  if (!consumo) return []
  if (!consumo.grupoId) return [consumo]
  return consumos.filter((c) => c.grupoId === consumo.grupoId)
}

// Jugadores entre los que está dividido el producto, en orden de parte.
export function jugadoresDe(consumos = [], consumo) {
  return grupoDe(consumos, consumo)
    .slice()
    .sort((a, b) => (a.parte?.n || 0) - (b.parte?.n || 0))
    .map((c) => c.jugador)
}

// Precio unitario del producto entero: la suma de las partes del grupo.
export function precioOriginal(consumos = [], consumo) {
  return grupoDe(consumos, consumo).reduce((s, c) => s + (Number(c.precio) || 0), 0)
}

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
export function redividirConsumo(planilla, consumo, nombres) {
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
      precio: grupo.reduce((s, c) => s + (Number(c.precio) || 0), 0),
      // El costo con el que entró la mercadería se conserva: es el del día en que
      // se cargó la venta, no el de la última compra.
      costo: grupo.reduce((s, c) => s + (Number(c.costo) || 0), 0),
    },
    nombres,
    consumo.cantidad,
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
