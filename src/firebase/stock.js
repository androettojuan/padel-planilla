import {
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  increment,
  query,
  where,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore'
import { isFirebaseConfigured } from './config'
import { clubCol, clubDoc, lsKey } from './paths'
import { uid } from '../utils/helpers'

// ---------------------------------------------------------------------------
// Stock del club. Dos colecciones bajo clubs/{clubId}:
//   stock/{productoId}  { cantidad, costo, minimo, actualizado }
//     Lo que queda de cada producto, el costo de la última compra y desde qué
//     cantidad avisar que hay que reponer. El id es el del producto en config.
//   stockCompras/{id}   { productoId, nombre, cantidad, costo, fecha, ts }
//     Historial de reposiciones: cuándo entró mercadería, cuánta y a qué costo.
//
// La cantidad se mueve con `increment`, no leyendo y escribiendo: los consumos se
// cargan desde varios dispositivos a la vez y dos ventas simultáneas tienen que
// descontar dos unidades, no una.
// ---------------------------------------------------------------------------

const readLocal = (clubId, col, fallback) => {
  try {
    const raw = localStorage.getItem(lsKey(clubId, col))
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const writeLocal = (clubId, col, value) =>
  localStorage.setItem(lsKey(clubId, col), JSON.stringify(value))

// Suscripción al stock del club como objeto { [productoId]: {...} }.
export function subscribeStock(clubId, onData, onError) {
  if (!isFirebaseConfigured) {
    onData(readLocal(clubId, 'stock', {}))
    return () => {}
  }
  return onSnapshot(
    clubCol(clubId, 'stock'),
    (snap) => {
      const out = {}
      snap.forEach((d) => {
        out[d.id] = d.data()
      })
      onData(out)
    },
    (err) => onError && onError(err),
  )
}

/**
 * Registra una compra: suma al stock, deja el costo unitario como costo actual
 * del producto y guarda el movimiento en el historial.
 */
export async function registrarCompra(clubId, { productoId, nombre, cantidad, costo, fecha }) {
  const unidades = Math.max(0, Math.round(Number(cantidad) || 0))
  const costoUnit = Math.max(0, Math.round(Number(costo) || 0))
  if (!productoId || unidades <= 0) return

  const compra = { id: uid(), productoId, nombre, cantidad: unidades, costo: costoUnit, fecha }

  if (!isFirebaseConfigured) {
    const stock = readLocal(clubId, 'stock', {})
    const actual = stock[productoId] || { cantidad: 0, costo: 0, minimo: 0 }
    stock[productoId] = { ...actual, cantidad: (Number(actual.cantidad) || 0) + unidades, costo: costoUnit }
    writeLocal(clubId, 'stock', stock)
    writeLocal(clubId, 'stockCompras', [...readLocal(clubId, 'stockCompras', []), compra])
    return
  }

  await setDoc(
    clubDoc(clubId, 'stock', productoId),
    { cantidad: increment(unidades), costo: costoUnit, actualizado: Date.now() },
    { merge: true },
  )
  const { id, ...data } = compra
  await setDoc(clubDoc(clubId, 'stockCompras', id), { ...data, ts: Date.now() })
}

/**
 * Corrige a mano las unidades que quedan (recuento, rotura, faltante). No es una
 * compra: no toca el costo ni suma al historial de compras.
 */
export async function ajustarStock(clubId, productoId, cantidad) {
  const unidades = Math.max(0, Math.round(Number(cantidad) || 0))
  if (!productoId) return
  if (!isFirebaseConfigured) {
    const stock = readLocal(clubId, 'stock', {})
    const actual = stock[productoId] || { cantidad: 0, costo: 0, minimo: 0 }
    stock[productoId] = { ...actual, cantidad: unidades }
    writeLocal(clubId, 'stock', stock)
    return
  }
  await setDoc(
    clubDoc(clubId, 'stock', productoId),
    { cantidad: unidades, actualizado: Date.now() },
    { merge: true },
  )
}

// Cantidad a partir de la cual el producto aparece como "hay que reponer".
export async function guardarMinimo(clubId, productoId, minimo) {
  const min = Math.max(0, Math.round(Number(minimo) || 0))
  if (!productoId) return
  if (!isFirebaseConfigured) {
    const stock = readLocal(clubId, 'stock', {})
    const actual = stock[productoId] || { cantidad: 0, costo: 0, minimo: 0 }
    stock[productoId] = { ...actual, minimo: min }
    writeLocal(clubId, 'stock', stock)
    return
  }
  await setDoc(clubDoc(clubId, 'stock', productoId), { minimo: min }, { merge: true })
}

/**
 * Mueve las unidades de varios productos de una vez: negativo al cargar un
 * consumo, positivo al darlo de baja. Solo afecta a los productos que ya están
 * bajo control de stock; los demás se venden sin descontar.
 *
 * `deltas` es { [productoId]: unidades }.
 */
export async function moverStock(clubId, deltas, controlados) {
  const entries = Object.entries(deltas || {}).filter(
    ([productoId, delta]) => delta && (!controlados || controlados.has(productoId)),
  )
  if (!entries.length) return

  if (!isFirebaseConfigured) {
    const stock = readLocal(clubId, 'stock', {})
    for (const [productoId, delta] of entries) {
      const actual = stock[productoId]
      if (!actual) continue
      stock[productoId] = { ...actual, cantidad: (Number(actual.cantidad) || 0) + delta }
    }
    writeLocal(clubId, 'stock', stock)
    return
  }

  await Promise.all(
    entries.map(([productoId, delta]) =>
      setDoc(
        clubDoc(clubId, 'stock', productoId),
        { cantidad: increment(delta), actualizado: Date.now() },
        { merge: true },
      ),
    ),
  )
}

/**
 * El costo del producto es el de su última compra. Después de corregir o deshacer
 * una compra hay que volver a mirar cuál quedó siendo la última: si se editó el
 * costo de la más nueva, ese es el nuevo; si se deshizo, vuelve el de la anterior;
 * y si no queda ninguna, queda en 0.
 *
 * Se filtra solo por producto y se ordena en memoria: son pocas compras por
 * producto y así no hace falta un índice compuesto.
 */
async function recalcularCosto(clubId, productoId) {
  if (!isFirebaseConfigured) {
    const compras = readLocal(clubId, 'stockCompras', []).filter((c) => c.productoId === productoId)
    const ultima = compras.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]
    const stock = readLocal(clubId, 'stock', {})
    if (stock[productoId]) {
      stock[productoId] = { ...stock[productoId], costo: ultima ? Number(ultima.costo) || 0 : 0 }
      writeLocal(clubId, 'stock', stock)
    }
    return
  }
  const snap = await getDocs(query(clubCol(clubId, 'stockCompras'), where('productoId', '==', productoId)))
  const compras = snap.docs.map((d) => d.data()).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const costo = compras.length ? Number(compras[0].costo) || 0 : 0
  await setDoc(clubDoc(clubId, 'stock', productoId), { costo }, { merge: true })
}

// Suma `delta` a las unidades sin dejar el stock en negativo. Se usa al corregir
// una compra ya cargada, donde parte de la mercadería puede estar vendida.
async function moverSinNegativos(clubId, productoId, delta) {
  if (!delta) return
  if (!isFirebaseConfigured) {
    const stock = readLocal(clubId, 'stock', {})
    const actual = stock[productoId]
    if (!actual) return
    stock[productoId] = {
      ...actual,
      cantidad: Math.max(0, (Number(actual.cantidad) || 0) + delta),
    }
    writeLocal(clubId, 'stock', stock)
    return
  }
  const ref = clubDoc(clubId, 'stock', productoId)
  if (delta > 0) {
    await setDoc(ref, { cantidad: increment(delta), actualizado: Date.now() }, { merge: true })
    return
  }
  const snap = await getDoc(ref)
  const actual = Number(snap.data()?.cantidad) || 0
  await setDoc(
    ref,
    { cantidad: Math.max(0, actual + delta), actualizado: Date.now() },
    { merge: true },
  )
}

/**
 * Corrige una compra ya cargada: ajusta el stock por la diferencia de unidades y
 * deja el costo nuevo. Si la mercadería que se saca ya se vendió, el stock se
 * queda en 0 en vez de irse a negativo.
 */
export async function editarCompra(clubId, compra, { cantidad, costo }) {
  const unidades = Math.max(0, Math.round(Number(cantidad) || 0))
  const costoUnit = Math.max(0, Math.round(Number(costo) || 0))
  if (!compra?.id || !compra.productoId || unidades <= 0) return
  const delta = unidades - (Number(compra.cantidad) || 0)

  if (!isFirebaseConfigured) {
    const compras = readLocal(clubId, 'stockCompras', []).map((c) =>
      c.id === compra.id ? { ...c, cantidad: unidades, costo: costoUnit } : c,
    )
    writeLocal(clubId, 'stockCompras', compras)
  } else {
    await setDoc(
      clubDoc(clubId, 'stockCompras', compra.id),
      { cantidad: unidades, costo: costoUnit },
      { merge: true },
    )
  }
  await moverSinNegativos(clubId, compra.productoId, delta)
  await recalcularCosto(clubId, compra.productoId)
}

/**
 * Deshace una compra cargada por error: saca del stock las unidades que había
 * sumado, borra el movimiento y devuelve el costo al de la compra anterior.
 */
export async function deshacerCompra(clubId, compra) {
  if (!compra?.id || !compra.productoId) return
  if (!isFirebaseConfigured) {
    writeLocal(
      clubId,
      'stockCompras',
      readLocal(clubId, 'stockCompras', []).filter((c) => c.id !== compra.id),
    )
  } else {
    await deleteDoc(clubDoc(clubId, 'stockCompras', compra.id))
  }
  await moverSinNegativos(clubId, compra.productoId, -(Number(compra.cantidad) || 0))
  await recalcularCosto(clubId, compra.productoId)
}

// Últimas compras cargadas, de la más nueva a la más vieja.
export async function loadCompras(clubId, max = 30) {
  if (!isFirebaseConfigured) {
    return readLocal(clubId, 'stockCompras', [])
      .slice()
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      .slice(0, max)
  }
  const snap = await getDocs(
    query(clubCol(clubId, 'stockCompras'), orderBy('ts', 'desc'), fbLimit(max)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
