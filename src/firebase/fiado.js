import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

// ---------------------------------------------------------------------------
// Fiados. Tres colecciones:
//   fiadoPagos/{id}   { id, nombre, nombreKey, monto, medio, fecha, creado }
//     Un pago (parcial o total) que una persona hace para saldar lo que debía.
//   fiadoCargos/{id}  { id, nombre, nombreKey, concepto, monto, fecha, creado }
//     Una deuda cargada a mano (para pasar al sistema lo anotado en papel), sin
//     pasar por una planilla del día.
//   fiadoCortes/{nombreKey}  { nombreKey, nombre, montoPlanilla, fecha, ts }
//     HISTÓRICO: ya no se crean. Venían de "saldar y archivar", que borraba los
//     pagos de la persona; como el resumen mensual suma cada pago a su medio
//     (contado/mercado), archivar hacía desaparecer esa plata de los totales del
//     mes. Se quitó esa acción, pero los cortes existentes se siguen leyendo
//     para que las cuentas archivadas antes no vuelvan a mostrar deuda vieja.
//   fiadoArchivados/{nombreKey}  { nombreKey, nombre, fecha, ts }
//     Marca de "limpiar de la vista", sin borrar NADA: los pagos y cargos siguen
//     enteros y los totales por medio del resumen mensual no cambian. Solo mueve
//     la cuenta a la sección "Archivados" del modal. Si después aparece un
//     movimiento nuevo (o el saldo deja de ser 0), la cuenta vuelve sola a la
//     lista principal para que una deuda nueva nunca quede escondida.
// El saldo de una persona = lo cobrado "Anotado" + cargos manuales − pagos,
// descontando lo archivado por el corte.
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

// Solo lectura: los cortes existentes se respetan, pero no se crean nuevos.
export const loadFiadoCortes = () => load('fiadoCortes')

export const loadFiadoArchivados = () => load('fiadoArchivados')
export const saveFiadoArchivado = (a) => save('fiadoArchivados', a)
export const deleteFiadoArchivado = (nombreKey) => remove('fiadoArchivados', nombreKey)
