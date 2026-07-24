import { setDoc, deleteDoc, getDocs } from 'firebase/firestore'
import { isFirebaseConfigured } from './config'
import { clubCol, clubDoc, lsKey } from './paths'

// ---------------------------------------------------------------------------
// Fiados de un club. Tres colecciones bajo clubs/{clubId}:
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
const read = (clubId, col) => {
  try {
    const raw = localStorage.getItem(lsKey(clubId, col))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
const write = (clubId, col, list) => localStorage.setItem(lsKey(clubId, col), JSON.stringify(list))

const load = async (clubId, col) => {
  if (!isFirebaseConfigured) return read(clubId, col)
  const snap = await getDocs(clubCol(clubId, col))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
const save = async (clubId, col, item) => {
  if (!isFirebaseConfigured) {
    const list = read(clubId, col)
    const i = list.findIndex((x) => x.id === item.id)
    if (i >= 0) list[i] = { ...list[i], ...item }
    else list.push(item)
    write(clubId, col, list)
    return
  }
  const { id, ...data } = item
  await setDoc(clubDoc(clubId, col, id), data, { merge: true })
}
const remove = async (clubId, col, id) => {
  if (!isFirebaseConfigured) {
    write(clubId, col, read(clubId, col).filter((x) => x.id !== id))
    return
  }
  await deleteDoc(clubDoc(clubId, col, id))
}

export const loadFiadoPagos = (clubId) => load(clubId, 'fiadoPagos')
export const saveFiadoPago = (clubId, pago) => save(clubId, 'fiadoPagos', pago)
export const deleteFiadoPago = (clubId, id) => remove(clubId, 'fiadoPagos', id)

export const loadFiadoCargos = (clubId) => load(clubId, 'fiadoCargos')
export const saveFiadoCargo = (clubId, cargo) => save(clubId, 'fiadoCargos', cargo)
export const deleteFiadoCargo = (clubId, id) => remove(clubId, 'fiadoCargos', id)

// Solo lectura: los cortes existentes se respetan, pero no se crean nuevos.
export const loadFiadoCortes = (clubId) => load(clubId, 'fiadoCortes')

export const loadFiadoArchivados = (clubId) => load(clubId, 'fiadoArchivados')
export const saveFiadoArchivado = (clubId, a) => save(clubId, 'fiadoArchivados', a)
export const deleteFiadoArchivado = (clubId, nombreKey) =>
  remove(clubId, 'fiadoArchivados', nombreKey)
