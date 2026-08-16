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
// un ajuste; hasta entonces se vende sin descontar nada: `cantidadDe` devuelve
// null y nadie le mueve unidades.
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

// Los productos se guardan y se muestran en orden alfabético, así la lista no
// depende de en qué orden se fueron cargando. `localeCompare` con sensibilidad
// base deja juntos "Coca" y "coca" y ordena bien los acentos.
export const ordenarProductos = (productos = []) =>
  [...productos].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', 'es', {
      sensitivity: 'base',
    }),
  )

// Los productos a los que hay que reponer, en el orden en que están cargados.
// Lo usan tanto la pestaña de Stock (para listarlos) como el aviso del menú
// (para saber si hay alguno), así la regla se define una sola vez.
export const productosAReponer = (stock, productos = []) =>
  productos.filter((p) => faltaReponer(stock, p.id))

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
