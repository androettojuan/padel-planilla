import {
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  startAt,
  endAt,
  getDocs,
  documentId,
} from 'firebase/firestore'
import { isFirebaseConfigured } from './config'
import { clubCol, clubDoc, lsKey } from './paths'
import { DEFAULT_CONFIG, emptyPlanilla } from '../data/defaults'

// Todas las funciones reciben el club activo: no hay estado global de club, así
// que es imposible leer o escribir en el club equivocado por descuido.

// ---------------------------------------------------------------------------
// Config del club (canchas, horarios, productos).
// Documento: clubs/{clubId}/config/club
// El nombre y la ubicación del club NO viven acá: están en clubs/{clubId}.
// ---------------------------------------------------------------------------
export async function loadConfig(clubId) {
  if (!isFirebaseConfigured) {
    try {
      const raw = localStorage.getItem(lsKey(clubId, 'config'))
      return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  }
  const ref = clubDoc(clubId, 'config', 'club')
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }
  return { ...DEFAULT_CONFIG, ...snap.data() }
}

export async function saveConfig(clubId, config) {
  if (!isFirebaseConfigured) {
    localStorage.setItem(lsKey(clubId, 'config'), JSON.stringify(config))
    return
  }
  await setDoc(clubDoc(clubId, 'config', 'club'), config, { merge: false })
}

// ---------------------------------------------------------------------------
// Planilla por día. Documento: clubs/{clubId}/planillas/{YYYY-MM-DD}
// ---------------------------------------------------------------------------
const planillaKey = (clubId, dateKey) => lsKey(clubId, `planilla:${dateKey}`)
const planillaPrefix = (clubId) => lsKey(clubId, 'planilla:')

export function subscribePlanilla(clubId, dateKey, onData, onError) {
  if (!isFirebaseConfigured) {
    // Modo demo: leemos de localStorage una sola vez.
    try {
      const raw = localStorage.getItem(planillaKey(clubId, dateKey))
      onData(raw ? JSON.parse(raw) : emptyPlanilla())
    } catch {
      onData(emptyPlanilla())
    }
    return () => {}
  }
  const ref = clubDoc(clubId, 'planillas', dateKey)
  return onSnapshot(
    ref,
    (snap) => onData(snap.exists() ? { ...emptyPlanilla(), ...snap.data() } : emptyPlanilla()),
    (err) => onError && onError(err),
  )
}

export async function savePlanilla(clubId, dateKey, planilla) {
  if (!isFirebaseConfigured) {
    localStorage.setItem(planillaKey(clubId, dateKey), JSON.stringify(planilla))
    return
  }
  await setDoc(clubDoc(clubId, 'planillas', dateKey), planilla, { merge: false })
}

// Lee de localStorage las planillas del club cuyo dateKey empieza con `desde`.
function readLocalPlanillas(clubId, desde = '') {
  const out = []
  const prefix = `${planillaPrefix(clubId)}${desde}`
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(prefix)) {
      try {
        out.push({
          dateKey: k.slice(planillaPrefix(clubId).length),
          data: JSON.parse(localStorage.getItem(k)),
        })
      } catch {
        /* ignoramos entradas corruptas */
      }
    }
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

// Trae todas las planillas de un mes ("YYYY-MM"). Devuelve [{ dateKey, data }].
export async function loadMonth(clubId, monthKey) {
  if (!isFirebaseConfigured) return readLocalPlanillas(clubId, monthKey)
  // Los doc id son "YYYY-MM-DD"; filtramos por rango sobre el id del documento.
  // El cierre usa el escape \uf8ff, más alto que cualquier dígito: cerrar en
  // "2026-07-" a secas daba un rango invertido —como texto es MENOR que
  // "2026-07-01"— y el mes salía siempre vacío.
  const q = query(
    clubCol(clubId, 'planillas'),
    orderBy(documentId()),
    startAt(`${monthKey}-01`),
    endAt(`${monthKey}-\uf8ff`),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ dateKey: d.id, data: d.data() }))
}

// Trae todas las planillas (sin filtro de mes). Lo usa el cálculo de saldos /
// fiados, que necesita sumar lo "anotado" a lo largo de todo el historial.
export async function loadAllPlanillas(clubId) {
  if (!isFirebaseConfigured) return readLocalPlanillas(clubId)
  const snap = await getDocs(query(clubCol(clubId, 'planillas'), orderBy(documentId())))
  return snap.docs.map((d) => ({ dateKey: d.id, data: d.data() }))
}
