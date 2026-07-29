import {
  setDoc,
  onSnapshot,
  getDocs,
  increment,
  query,
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
