import {
  setDoc,
  updateDoc,
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
import { clubCol, clubDoc, readLocal, writeLocal } from './paths'
import { rangoMes, uid } from '../utils/helpers'

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

const PRODUCTO_VACIO = { cantidad: 0, costo: 0, minimo: 0 }

// Espejo local del stock (modo demo): aplica `cambios` sobre un producto,
// creándolo si es la primera vez que se lo toca. `cambios` puede ser una función
// que recibe lo que había, para los movimientos relativos.
function patchLocal(clubId, productoId, cambios) {
  const stock = readLocal(clubId, 'stock', {})
  const actual = stock[productoId] || PRODUCTO_VACIO
  stock[productoId] = { ...actual, ...(typeof cambios === 'function' ? cambios(actual) : cambios) }
  writeLocal(clubId, 'stock', stock)
}

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
 * del producto y guarda el movimiento en el historial. Devuelve la compra
 * cargada, para que la pantalla la agregue a la lista sin volver a leerla.
 */
export async function registrarCompra(clubId, { productoId, nombre, cantidad, costo, fecha }) {
  const unidades = Math.max(0, Math.round(Number(cantidad) || 0))
  const costoUnit = Math.max(0, Math.round(Number(costo) || 0))
  if (!productoId || unidades <= 0) return null

  const compra = {
    id: uid(),
    productoId,
    nombre,
    cantidad: unidades,
    costo: costoUnit,
    fecha,
    ts: Date.now(),
  }

  if (!isFirebaseConfigured) {
    patchLocal(clubId, productoId, (actual) => ({
      cantidad: (Number(actual.cantidad) || 0) + unidades,
      costo: costoUnit,
    }))
    writeLocal(clubId, 'stockCompras', [...readLocal(clubId, 'stockCompras', []), compra])
    return compra
  }

  // Son dos documentos independientes: van juntos y no uno después del otro.
  const { id, ...data } = compra
  await Promise.all([
    setDoc(
      clubDoc(clubId, 'stock', productoId),
      { cantidad: increment(unidades), costo: costoUnit, actualizado: Date.now() },
      { merge: true },
    ),
    setDoc(clubDoc(clubId, 'stockCompras', id), data),
  ])
  return compra
}

/**
 * Corrige a mano las unidades que quedan (recuento, rotura, faltante). No es una
 * compra: no toca el costo ni suma al historial de compras.
 */
export async function ajustarStock(clubId, productoId, cantidad) {
  const unidades = Math.max(0, Math.round(Number(cantidad) || 0))
  if (!productoId) return
  if (!isFirebaseConfigured) {
    patchLocal(clubId, productoId, { cantidad: unidades })
    return
  }
  await setDoc(
    clubDoc(clubId, 'stock', productoId),
    { cantidad: unidades, actualizado: Date.now() },
    { merge: true },
  )
}

/**
 * Corrige a mano el costo unitario del producto (mercadería vieja, un precio mal
 * cargado). Lo normal es que lo deje la última compra: si después se corrige o
 * se deshace una compra, el costo vuelve a salir del historial y pisa esto.
 */
export async function guardarCosto(clubId, productoId, costo) {
  const costoUnit = Math.max(0, Math.round(Number(costo) || 0))
  if (!productoId) return
  if (!isFirebaseConfigured) {
    patchLocal(clubId, productoId, { costo: costoUnit })
    return
  }
  await setDoc(
    clubDoc(clubId, 'stock', productoId),
    { costo: costoUnit, actualizado: Date.now() },
    { merge: true },
  )
}

// Cantidad a partir de la cual el producto aparece como "hay que reponer".
export async function guardarMinimo(clubId, productoId, minimo) {
  const min = Math.max(0, Math.round(Number(minimo) || 0))
  if (!productoId) return
  if (!isFirebaseConfigured) {
    patchLocal(clubId, productoId, { minimo: min })
    return
  }
  await setDoc(clubDoc(clubId, 'stock', productoId), { minimo: min }, { merge: true })
}

/**
 * Mueve las unidades de varios productos de una vez: negativo al cargar un
 * consumo, positivo al darlo de baja. Solo afecta a los productos que ya están
 * bajo control de stock; los demás se venden sin descontar.
 *
 * Quién está bajo control lo decide el propio dato: se usa `updateDoc`, que falla
 * si el producto no tiene documento de stock, en vez de `setDoc(merge)`, que lo
 * crearía con cantidad negativa. Así el que llama no tiene que pasar la lista de
 * productos controlados ni quedar desactualizado respecto de la base.
 *
 * `deltas` es { [productoId]: unidades }.
 */
export async function moverStock(clubId, deltas) {
  const entries = Object.entries(deltas || {}).filter(([, delta]) => delta)
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
      updateDoc(clubDoc(clubId, 'stock', productoId), {
        cantidad: increment(delta),
        actualizado: Date.now(),
      }).catch((err) => {
        // El producto no se controla: se vende sin descontar, no es un error.
        if (err?.code !== 'not-found') throw err
      }),
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
    patchLocal(clubId, productoId, { costo: ultima ? Number(ultima.costo) || 0 : 0 })
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
    patchLocal(clubId, productoId, (actual) => ({
      cantidad: Math.max(0, (Number(actual.cantidad) || 0) + delta),
    }))
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

  // La compra y el stock son documentos distintos: se escriben a la vez. El costo
  // se recalcula después, porque necesita el historial ya corregido.
  await Promise.all([
    isFirebaseConfigured
      ? setDoc(
          clubDoc(clubId, 'stockCompras', compra.id),
          { cantidad: unidades, costo: costoUnit },
          { merge: true },
        )
      : writeLocal(
          clubId,
          'stockCompras',
          readLocal(clubId, 'stockCompras', []).map((c) =>
            c.id === compra.id ? { ...c, cantidad: unidades, costo: costoUnit } : c,
          ),
        ),
    moverSinNegativos(clubId, compra.productoId, delta),
  ])
  await recalcularCosto(clubId, compra.productoId)
}

/**
 * Deshace una compra cargada por error: saca del stock las unidades que había
 * sumado, borra el movimiento y devuelve el costo al de la compra anterior.
 */
export async function deshacerCompra(clubId, compra) {
  if (!compra?.id || !compra.productoId) return
  await Promise.all([
    isFirebaseConfigured
      ? deleteDoc(clubDoc(clubId, 'stockCompras', compra.id))
      : writeLocal(
          clubId,
          'stockCompras',
          readLocal(clubId, 'stockCompras', []).filter((c) => c.id !== compra.id),
        ),
    moverSinNegativos(clubId, compra.productoId, -(Number(compra.cantidad) || 0)),
  ])
  await recalcularCosto(clubId, compra.productoId)
}

/**
 * Compras cargadas en un mes ("YYYY-MM"), para saber cuánto se gastó reponiendo
 * mercadería. Se filtra por el campo `fecha` (YYYY-MM-DD) con un rango de texto,
 * que al ser un solo campo no necesita índice compuesto.
 */
export async function loadComprasMes(clubId, monthKey) {
  const [desde, hasta] = rangoMes(monthKey)
  if (!isFirebaseConfigured) {
    return readLocal(clubId, 'stockCompras', []).filter(
      (c) => (c.fecha || '') >= desde && (c.fecha || '') <= hasta,
    )
  }
  const snap = await getDocs(
    query(
      clubCol(clubId, 'stockCompras'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    ),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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
