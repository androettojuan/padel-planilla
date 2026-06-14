import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

// ---------------------------------------------------------------------------
// Directorio de jugadores del club. Colección: jugadores/{id}
//   { id, nombre, alias?, telefono?, activo, creado }
// Se usa para autocompletar nombres y, más adelante, para los saldos/fiados.
// ---------------------------------------------------------------------------
const LS_KEY = 'jugadores'

const readLocal = () => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
const writeLocal = (list) => localStorage.setItem(LS_KEY, JSON.stringify(list))

// Notifica la lista completa cada vez que cambia. En modo demo (sin Firebase)
// lee de localStorage una sola vez.
export function subscribeJugadores(onData, onError) {
  if (!isFirebaseConfigured) {
    onData(readLocal())
    return () => {}
  }
  return onSnapshot(
    collection(db, 'jugadores'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err),
  )
}

export async function saveJugador(jugador) {
  if (!isFirebaseConfigured) {
    const list = readLocal()
    const i = list.findIndex((j) => j.id === jugador.id)
    if (i >= 0) list[i] = { ...list[i], ...jugador }
    else list.push(jugador)
    writeLocal(list)
    return
  }
  const { id, ...data } = jugador
  await setDoc(doc(db, 'jugadores', id), data, { merge: true })
}

export async function deleteJugador(id) {
  if (!isFirebaseConfigured) {
    writeLocal(readLocal().filter((j) => j.id !== id))
    return
  }
  await deleteDoc(doc(db, 'jugadores', id))
}

// Carga puntual (sin suscripción). Útil para procesos one-shot.
export async function loadJugadores() {
  if (!isFirebaseConfigured) return readLocal()
  const snap = await getDocs(collection(db, 'jugadores'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
