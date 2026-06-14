import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

// ---------------------------------------------------------------------------
// Fiados. Dos colecciones:
//   fiadoPagos/{id}   { id, nombre, nombreKey, monto, medio, fecha, creado }
//     Un pago (parcial o total) que una persona hace para saldar lo que debía.
//   fiadoCargos/{id}  { id, nombre, nombreKey, concepto, monto, fecha, creado }
//     Una deuda cargada a mano (para pasar al sistema lo anotado en papel), sin
//     pasar por una planilla del día.
// El saldo de una persona = lo cobrado "Anotado" + cargos manuales − pagos.
// ---------------------------------------------------------------------------
const read = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
const write = (key, list) => localStorage.setItem(key, JSON.stringify(list))

const load = async (col) => {
  if (!isFirebaseConfigured) return read(col)
  const snap = await getDocs(collection(db, col))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
const save = async (col, item) => {
  if (!isFirebaseConfigured) {
    const list = read(col)
    const i = list.findIndex((x) => x.id === item.id)
    if (i >= 0) list[i] = { ...list[i], ...item }
    else list.push(item)
    write(col, list)
    return
  }
  const { id, ...data } = item
  await setDoc(doc(db, col, id), data, { merge: true })
}
const remove = async (col, id) => {
  if (!isFirebaseConfigured) {
    write(col, read(col).filter((x) => x.id !== id))
    return
  }
  await deleteDoc(doc(db, col, id))
}

export const loadFiadoPagos = () => load('fiadoPagos')
export const saveFiadoPago = (pago) => save('fiadoPagos', pago)
export const deleteFiadoPago = (id) => remove('fiadoPagos', id)

export const loadFiadoCargos = () => load('fiadoCargos')
export const saveFiadoCargo = (cargo) => save('fiadoCargos', cargo)
export const deleteFiadoCargo = (id) => remove('fiadoCargos', id)
