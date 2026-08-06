// Formato del dump: JSON plano con la forma
//   { "<ruta/del/doc>": { ...campos }, ... }
// La ruta lleva la jerarquía completa ("clubs/carest/planillas/2026-07-01"), así
// que el archivo sirve igual para el modelo viejo (colecciones raíz) y el nuevo.
//
// Los tipos que no son JSON (Timestamp, GeoPoint, referencias) se codifican como
// objetos con marca `__type__` para poder reconstruirlos al sembrar.
import { Timestamp, GeoPoint } from 'firebase-admin/firestore'

export function encode(value) {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Timestamp) return { __type__: 'timestamp', value: value.toDate().toISOString() }
  if (value instanceof GeoPoint) return { __type__: 'geopoint', lat: value.latitude, lng: value.longitude }
  if (value instanceof Date) return { __type__: 'timestamp', value: value.toISOString() }
  if (Buffer.isBuffer(value)) return { __type__: 'bytes', value: value.toString('base64') }
  if (typeof value.path === 'string' && typeof value.id === 'string' && value.firestore) {
    return { __type__: 'ref', path: value.path }
  }
  if (Array.isArray(value)) return value.map(encode)
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]))
}

export function decode(value, db) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => decode(v, db))
  switch (value.__type__) {
    case 'timestamp':
      return Timestamp.fromDate(new Date(value.value))
    case 'geopoint':
      return new GeoPoint(value.lat, value.lng)
    case 'bytes':
      return Buffer.from(value.value, 'base64')
    case 'ref':
      return db.doc(value.path)
    default:
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v, db)]))
  }
}

// Recorre recursivamente todas las colecciones y subcolecciones.
export async function dumpAll(db, { onDoc } = {}) {
  const out = {}
  const walk = async (colRef) => {
    const snap = await colRef.get()
    for (const doc of snap.docs) {
      out[doc.ref.path] = encode(doc.data())
      onDoc?.(doc.ref.path)
      for (const sub of await doc.ref.listCollections()) await walk(sub)
    }
  }
  for (const col of await db.listCollections()) await walk(col)
  return out
}

// Escribe un dump en lotes (Firestore admite 500 operaciones por batch).
export async function writeAll(db, docs, { batchSize = 400, merge = false } = {}) {
  const entries = Object.entries(docs)
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = db.batch()
    for (const [path, data] of entries.slice(i, i + batchSize)) {
      batch.set(db.doc(path), decode(data, db), { merge })
    }
    await batch.commit()
  }
  return entries.length
}
