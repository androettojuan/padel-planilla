import { setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore'
import { isFirebaseConfigured } from './config'
import { clubCol, clubDoc, readLocal as leer, writeLocal as escribir } from './paths'

// ---------------------------------------------------------------------------
// Directorio de jugadores del club. Colección: clubs/{clubId}/jugadores/{id}
//   { id, nombre, alias?, telefono?, activo, creado }
// Se usa para autocompletar nombres y para los saldos/fiados.
// ---------------------------------------------------------------------------
const readLocal = (clubId) => leer(clubId, 'jugadores', [])
const writeLocal = (clubId, list) => escribir(clubId, 'jugadores', list)

// Notifica la lista completa cada vez que cambia. En modo demo (sin Firebase)
// lee de localStorage una sola vez.
export function subscribeJugadores(clubId, onData, onError) {
  if (!isFirebaseConfigured) {
    onData(readLocal(clubId))
    return () => {}
  }
  return onSnapshot(
    clubCol(clubId, 'jugadores'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err),
  )
}

export async function saveJugador(clubId, jugador) {
  if (!isFirebaseConfigured) {
    const list = readLocal(clubId)
    const i = list.findIndex((j) => j.id === jugador.id)
    if (i >= 0) list[i] = { ...list[i], ...jugador }
    else list.push(jugador)
    writeLocal(clubId, list)
    return
  }
  const { id, ...data } = jugador
  await setDoc(clubDoc(clubId, 'jugadores', id), data, { merge: true })
}

export async function deleteJugador(clubId, id) {
  if (!isFirebaseConfigured) {
    writeLocal(clubId, readLocal(clubId).filter((j) => j.id !== id))
    return
  }
  await deleteDoc(clubDoc(clubId, 'jugadores', id))
}

// Carga puntual (sin suscripción). Útil para procesos one-shot.
export async function loadJugadores(clubId) {
  if (!isFirebaseConfigured) return readLocal(clubId)
  const snap = await getDocs(clubCol(clubId, 'jugadores'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
