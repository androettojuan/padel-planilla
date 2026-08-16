import { setDoc, deleteDoc, onSnapshot, getDocs, query, where } from 'firebase/firestore'
import { isFirebaseConfigured } from './config'
import { clubCol, clubDoc, readLocal, writeLocal } from './paths'
import { uid } from '../utils/helpers'

// ---------------------------------------------------------------------------
// Gastos fijos del club. Dos colecciones bajo clubs/{clubId}:
//   gastosFijos/{id}   { nombre, monto, activo, creado }
//     La plantilla: qué se paga todos los meses y cuánto suele salir. El `monto`
//     es de referencia, no lo que se pagó.
//   gastosPagos/{id}   { gastoId, nombre, monto, mes, fecha, ts }
//     Lo que realmente se pagó, un documento por gasto y por mes. La luz no sale
//     lo mismo en junio que en enero, así que el monto real vive acá y no pisa
//     el de la plantilla.
//
// Un gasto figura como pagado en un mes si existe su pago; deshacerlo es borrar
// ese documento. `nombre` se copia en el pago para que el historial siga siendo
// legible si después se renombra o se borra el gasto de la plantilla.
// ---------------------------------------------------------------------------

export function subscribeGastosFijos(clubId, onData, onError) {
  if (!isFirebaseConfigured) {
    onData(readLocal(clubId, 'gastosFijos', []))
    return () => {}
  }
  return onSnapshot(
    clubCol(clubId, 'gastosFijos'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err),
  )
}

export async function saveGastoFijo(clubId, gasto) {
  if (!isFirebaseConfigured) {
    const list = readLocal(clubId, 'gastosFijos', [])
    const i = list.findIndex((g) => g.id === gasto.id)
    if (i >= 0) list[i] = { ...list[i], ...gasto }
    else list.push(gasto)
    writeLocal(clubId, 'gastosFijos', list)
    return
  }
  const { id, ...data } = gasto
  await setDoc(clubDoc(clubId, 'gastosFijos', id), data, { merge: true })
}

/**
 * Saca un gasto de la plantilla. Los pagos ya cargados quedan: son plata que
 * salió de verdad y el resumen de esos meses tiene que seguir cerrando.
 */
export async function deleteGastoFijo(clubId, id) {
  if (!isFirebaseConfigured) {
    writeLocal(
      clubId,
      'gastosFijos',
      readLocal(clubId, 'gastosFijos', []).filter((g) => g.id !== id),
    )
    return
  }
  await deleteDoc(clubDoc(clubId, 'gastosFijos', id))
}

// Pagos de un mes ("YYYY-MM"). Filtra por un solo campo, así que no necesita
// índice compuesto.
export async function loadPagosMes(clubId, mes) {
  if (!isFirebaseConfigured) {
    return readLocal(clubId, 'gastosPagos', []).filter((p) => p.mes === mes)
  }
  const snap = await getDocs(query(clubCol(clubId, 'gastosPagos'), where('mes', '==', mes)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Registra el pago de un gasto en un mes. Devuelve el pago cargado, para que la
 * pantalla lo agregue a la lista sin volver a leer el mes.
 */
export async function pagarGasto(clubId, { gastoId, nombre, monto, mes, fecha }) {
  const importe = Math.max(0, Math.round(Number(monto) || 0))
  if (!gastoId || !mes) return null

  const pago = { id: uid(), gastoId, nombre, monto: importe, mes, fecha, ts: Date.now() }

  if (!isFirebaseConfigured) {
    writeLocal(clubId, 'gastosPagos', [...readLocal(clubId, 'gastosPagos', []), pago])
    return pago
  }
  const { id, ...data } = pago
  await setDoc(clubDoc(clubId, 'gastosPagos', id), data)
  return pago
}

// Corrige un pago ya cargado (vino otro importe, se pagó otro día).
export async function editarPagoGasto(clubId, pagoId, { monto, fecha }) {
  const importe = Math.max(0, Math.round(Number(monto) || 0))
  if (!pagoId) return
  if (!isFirebaseConfigured) {
    writeLocal(
      clubId,
      'gastosPagos',
      readLocal(clubId, 'gastosPagos', []).map((p) =>
        p.id === pagoId ? { ...p, monto: importe, fecha } : p,
      ),
    )
    return
  }
  await setDoc(clubDoc(clubId, 'gastosPagos', pagoId), { monto: importe, fecha }, { merge: true })
}

// Deshace un pago: el gasto vuelve a figurar como pendiente en ese mes.
export async function borrarPagoGasto(clubId, pagoId) {
  if (!pagoId) return
  if (!isFirebaseConfigured) {
    writeLocal(
      clubId,
      'gastosPagos',
      readLocal(clubId, 'gastosPagos', []).filter((p) => p.id !== pagoId),
    )
    return
  }
  await deleteDoc(clubDoc(clubId, 'gastosPagos', pagoId))
}
