import { setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore'
import { isFirebaseConfigured } from './config'
import { clubCol, clubDoc, readLocal, writeLocal } from './paths'
import { rangoMes, uid } from '../utils/helpers'

// ---------------------------------------------------------------------------
// Gastos del club. Una sola colección bajo clubs/{clubId}:
//   gastos/{id}   { nombre, monto, fecha, ts }
//
// Cada gasto es lo que se pagó: la fecha, en qué (luz, agua, gas, lo que sea) y
// cuánto. No hay lista fija ni gastos "por pagar": se anota lo que salió, igual
// que una compra de mercadería.
// ---------------------------------------------------------------------------

/**
 * Gastos de un mes ("YYYY-MM"). Se filtra por el campo `fecha` (YYYY-MM-DD) con
 * un rango de texto, que al ser un solo campo no necesita índice compuesto.
 */
export async function loadGastosMes(clubId, monthKey) {
  const [desde, hasta] = rangoMes(monthKey)
  if (!isFirebaseConfigured) {
    return readLocal(clubId, 'gastos', []).filter(
      (g) => (g.fecha || '') >= desde && (g.fecha || '') <= hasta,
    )
  }
  const snap = await getDocs(
    query(clubCol(clubId, 'gastos'), where('fecha', '>=', desde), where('fecha', '<=', hasta)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Anota un gasto. Devuelve el gasto cargado, para que la pantalla lo agregue a
 * la lista sin volver a leer el mes.
 */
export async function agregarGasto(clubId, { nombre, monto, fecha }) {
  const importe = Math.max(0, Math.round(Number(monto) || 0))
  const desc = (nombre || '').trim()
  if (!desc || importe <= 0 || !fecha) return null

  const gasto = { id: uid(), nombre: desc, monto: importe, fecha, ts: Date.now() }

  if (!isFirebaseConfigured) {
    writeLocal(clubId, 'gastos', [...readLocal(clubId, 'gastos', []), gasto])
    return gasto
  }
  const { id, ...data } = gasto
  await setDoc(clubDoc(clubId, 'gastos', id), data)
  return gasto
}

// Borra un gasto cargado por error.
export async function borrarGasto(clubId, id) {
  if (!id) return
  if (!isFirebaseConfigured) {
    writeLocal(
      clubId,
      'gastos',
      readLocal(clubId, 'gastos', []).filter((g) => g.id !== id),
    )
    return
  }
  await deleteDoc(clubDoc(clubId, 'gastos', id))
}
