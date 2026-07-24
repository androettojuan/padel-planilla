import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'
import { clubDocRef, clubCol } from './paths'

// ---------------------------------------------------------------------------
// Clubes y sus miembros.
//   clubs/{clubId}                  { nombre, ubicacion, activo, creado }
//   clubs/{clubId}/miembros/{email} { email, nombre?, creado }
//   superAdmins/{email}             se carga a mano desde la consola
// ---------------------------------------------------------------------------

const LS_CLUBS = 'clubs'

const readLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const writeLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value))

// En modo demo hay un único club local para que la app funcione sin Firebase.
export const DEMO_CLUB = { id: 'demo', nombre: 'Club de prueba', ubicacion: '', activo: true }

export async function isSuperAdmin(email) {
  if (!isFirebaseConfigured) return true // modo demo: acceso total local
  if (!email) return false
  try {
    const snap = await getDoc(doc(db, 'superAdmins', email))
    return snap.exists()
  } catch {
    return false
  }
}

// Clubes a los que pertenece un usuario. Se resuelve con una consulta de grupo
// de colecciones sobre `miembros` filtrada por email (ver firestore.rules).
export async function loadClubsDelUsuario(email) {
  if (!isFirebaseConfigured) return readLocal(LS_CLUBS, [DEMO_CLUB])
  if (!email) return []
  const snap = await getDocs(query(collectionGroup(db, 'miembros'), where('email', '==', email)))
  const ids = snap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean)
  const clubs = await Promise.all(ids.map((id) => loadClub(id)))
  return clubs.filter(Boolean).filter((c) => c.activo !== false)
}

// Todos los clubes (solo lo puede leer un super admin).
export async function loadTodosLosClubs() {
  if (!isFirebaseConfigured) return readLocal(LS_CLUBS, [DEMO_CLUB])
  const snap = await getDocs(query(collection(db, 'clubs'), orderBy('nombre')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function loadClub(clubId) {
  if (!isFirebaseConfigured) {
    return readLocal(LS_CLUBS, [DEMO_CLUB]).find((c) => c.id === clubId) || null
  }
  const snap = await getDoc(clubDocRef(clubId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function crearClub({ id, nombre, ubicacion = '' }) {
  const club = { nombre, ubicacion, activo: true, creado: Date.now() }
  if (!isFirebaseConfigured) {
    const list = readLocal(LS_CLUBS, [DEMO_CLUB])
    writeLocal(LS_CLUBS, [...list.filter((c) => c.id !== id), { id, ...club }])
    return { id, ...club }
  }
  const ref = clubDocRef(id)
  if ((await getDoc(ref)).exists()) throw new Error(`Ya existe un club con el id "${id}"`)
  await setDoc(ref, club)
  return { id, ...club }
}

export async function actualizarClub(clubId, cambios) {
  if (!isFirebaseConfigured) {
    const list = readLocal(LS_CLUBS, [DEMO_CLUB])
    writeLocal(LS_CLUBS, list.map((c) => (c.id === clubId ? { ...c, ...cambios } : c)))
    return
  }
  await updateDoc(clubDocRef(clubId), cambios)
}

// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------
const lsMiembros = (clubId) => `club:${clubId}:miembros`

export async function loadMiembros(clubId) {
  if (!isFirebaseConfigured) return readLocal(lsMiembros(clubId), [])
  const snap = await getDocs(clubCol(clubId, 'miembros'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function agregarMiembro(clubId, email, nombre = '') {
  const limpio = String(email || '').trim().toLowerCase()
  if (!limpio) throw new Error('Falta el email')
  const miembro = { email: limpio, nombre, creado: Date.now() }
  if (!isFirebaseConfigured) {
    const list = readLocal(lsMiembros(clubId), [])
    writeLocal(lsMiembros(clubId), [
      ...list.filter((m) => m.email !== limpio),
      { id: limpio, ...miembro },
    ])
    return
  }
  await setDoc(doc(db, 'clubs', clubId, 'miembros', limpio), miembro, { merge: true })
}

export async function quitarMiembro(clubId, email) {
  if (!isFirebaseConfigured) {
    const list = readLocal(lsMiembros(clubId), [])
    writeLocal(lsMiembros(clubId), list.filter((m) => m.email !== email))
    return
  }
  await deleteDoc(doc(db, 'clubs', clubId, 'miembros', email))
}
