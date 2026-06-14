import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  getDocs,
  documentId,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'
import { DEFAULT_CONFIG, emptyPlanilla } from '../data/defaults'

const CONFIG_LS_KEY = 'config:club'

// ---------------------------------------------------------------------------
// Config del club (canchas, horarios, productos). Documento: config/club
// ---------------------------------------------------------------------------
export async function loadConfig() {
  if (!isFirebaseConfigured) {
    try {
      const raw = localStorage.getItem(CONFIG_LS_KEY)
      return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  }
  const ref = doc(db, 'config', 'club')
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }
  return { ...DEFAULT_CONFIG, ...snap.data() }
}

export async function saveConfig(config) {
  if (!isFirebaseConfigured) {
    localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(config))
    return
  }
  await setDoc(doc(db, 'config', 'club'), config, { merge: false })
}

// ---------------------------------------------------------------------------
// Planilla por día. Documento: planillas/{YYYY-MM-DD}
// ---------------------------------------------------------------------------
const lsKey = (dateKey) => `planilla:${dateKey}`

export function subscribePlanilla(dateKey, onData, onError) {
  if (!isFirebaseConfigured) {
    // Modo demo: leemos de localStorage una sola vez.
    try {
      const raw = localStorage.getItem(lsKey(dateKey))
      onData(raw ? JSON.parse(raw) : emptyPlanilla())
    } catch {
      onData(emptyPlanilla())
    }
    return () => {}
  }
  const ref = doc(db, 'planillas', dateKey)
  return onSnapshot(
    ref,
    (snap) => onData(snap.exists() ? { ...emptyPlanilla(), ...snap.data() } : emptyPlanilla()),
    (err) => onError && onError(err),
  )
}

export async function savePlanilla(dateKey, planilla) {
  if (!isFirebaseConfigured) {
    localStorage.setItem(lsKey(dateKey), JSON.stringify(planilla))
    return
  }
  const ref = doc(db, 'planillas', dateKey)
  await setDoc(ref, planilla, { merge: false })
}

// Trae todas las planillas de un mes ("YYYY-MM"). Devuelve [{ dateKey, data }].
export async function loadMonth(monthKey) {
  if (!isFirebaseConfigured) {
    const out = []
    const prefix = `${lsKey(monthKey)}` // "planilla:YYYY-MM"
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) {
        try {
          out.push({ dateKey: k.slice('planilla:'.length), data: JSON.parse(localStorage.getItem(k)) })
        } catch {
          /* ignoramos entradas corruptas */
        }
      }
    }
    return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  }
  // Los doc id son "YYYY-MM-DD"; filtramos por rango sobre el id del documento.
  const q = query(
    collection(db, 'planillas'),
    orderBy(documentId()),
    startAt(`${monthKey}-01`),
    endAt(`${monthKey}-`),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ dateKey: d.id, data: d.data() }))
}
