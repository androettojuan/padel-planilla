import { grupoDe } from './consumos'

// Stock del club: cuántas unidades quedan de cada producto, a qué costo entraron
// y desde qué cantidad hay que reponer.
//
//   stock: { [productoId]: { cantidad, costo, minimo } }
//
// El costo es el de la última compra cargada, y es el que se usa para valorizar
// lo que queda y para calcular la ganancia. Un producto sin entrada en `stock`
// no se controla (el alquiler de paletas, por ejemplo): no descuenta ni avisa.

export const stockDe = (stock, productoId) => stock?.[productoId] || null

// Un producto entra al control de stock recién cuando se le carga una compra o
// un ajuste; hasta entonces se vende sin descontar nada.
export const controlaStock = (stock, productoId) => !!stockDe(stock, productoId)

export function cantidadDe(stock, productoId) {
  const s = stockDe(stock, productoId)
  return s ? Number(s.cantidad) || 0 : null
}

export function costoDe(stock, productoId) {
  const s = stockDe(stock, productoId)
  return s ? Number(s.costo) || 0 : 0
}

// Hay que reponer cuando quedan igual o menos unidades que el mínimo cargado.
export function faltaReponer(stock, productoId) {
  const s = stockDe(stock, productoId)
  if (!s) return false
  const minimo = Number(s.minimo) || 0
  if (minimo <= 0) return false
  return (Number(s.cantidad) || 0) <= minimo
}

/**
 * Unidades físicas que representa una línea de consumo.
 *
 * Un producto dividido entre varios jugadores son varias líneas del mismo
 * producto: un tubo de pelotas entre tres son tres líneas de una unidad, pero
 * del stock salió UN tubo. Por eso la unidad se cuenta una sola vez por grupo,
 * en la primera parte, y las demás no descuentan nada.
 */
export function unidadesDeLinea(consumos, linea) {
  if (!linea) return 0
  const cantidad = Math.max(0, Number(linea.cantidad) || 0)
  if (!linea.grupoId) return cantidad
  const grupo = grupoDe(consumos, linea)
  const primera = grupo.reduce((min, c) => ((c.parte?.n || 0) < (min.parte?.n || 0) ? c : min), grupo[0])
  return primera?.id === linea.id ? cantidad : 0
}

/**
 * Cuántas unidades de cada producto salieron del stock por estas líneas.
 * Devuelve { [productoId]: unidades }, contando una vez los productos
 * compartidos. `consumos` es la lista completa donde viven las líneas, que es de
 * donde se reconstruyen los grupos.
 */
export function unidadesPorProducto(consumos, lineas) {
  const out = {}
  for (const linea of lineas || []) {
    const unidades = unidadesDeLinea(consumos, linea)
    if (!unidades) continue
    out[linea.productoId] = (out[linea.productoId] || 0) + unidades
  }
  return out
}

// Plata inmovilizada en mercadería: lo que queda de cada producto por su costo.
export function valorStock(stock, productos = []) {
  let total = 0
  for (const p of productos) {
    const s = stockDe(stock, p.id)
    if (!s) continue
    total += (Number(s.cantidad) || 0) * (Number(s.costo) || 0)
  }
  return total
}
