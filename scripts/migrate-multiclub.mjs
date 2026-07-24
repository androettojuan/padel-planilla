// Migra la base de un solo club (colecciones raíz) al modelo multi-club
// (todo bajo clubs/{clubId}). No borra nada del origen: copia y deja los datos
// viejos donde están, así se puede verificar antes de limpiar.
//
//   node scripts/migrate-multiclub.mjs --emulator --dry-run     ← probar
//   node scripts/migrate-multiclub.mjs --emulator               ← migrar local
//   node scripts/migrate-multiclub.mjs                          ← migrar PRODUCCIÓN
//   node scripts/migrate-multiclub.mjs --emulator --limpiar     ← borrar el origen
//
// Opciones: --club=carest  --nombre="Carest Padel"  --ubicacion="..."
import { getDb, args } from './lib/admin.mjs'

const COLECCIONES = [
  'config',
  'planillas',
  'jugadores',
  'fiadoPagos',
  'fiadoCargos',
  'fiadoCortes',
  'fiadoArchivados',
]

const opts = args()
const clubId = opts.club || 'carest'
const dryRun = !!opts['dry-run']
const db = getDb({ emulator: !!opts.emulator })

const log = (...a) => console.log(dryRun ? '[dry-run]' : '        ', ...a)

// ---------------------------------------------------------------------------
// 1. Documento del club. El nombre sale de config/club (donde vive hoy) salvo
//    que se pase por parámetro.
// ---------------------------------------------------------------------------
const configSnap = await db.doc('config/club').get()
const configData = configSnap.exists ? configSnap.data() : {}
const club = {
  nombre: opts.nombre || configData?.club?.nombre || 'Club',
  ubicacion: opts.ubicacion || configData?.club?.ubicacion || '',
  activo: true,
  creado: Date.now(),
}

log(`club ${clubId}: ${club.nombre} (${club.ubicacion || 'sin ubicación'})`)
if (!dryRun) await db.doc(`clubs/${clubId}`).set(club, { merge: true })

// ---------------------------------------------------------------------------
// 2. Miembros a partir de la allowlist actual (el id del doc es el email).
// ---------------------------------------------------------------------------
const allow = await db.collection('allowlist').get()
log(`miembros: ${allow.size} emails desde allowlist`)
for (const d of allow.docs) {
  const email = d.id
  log(`  · ${email}`)
  if (!dryRun) {
    await db.doc(`clubs/${clubId}/miembros/${email}`).set(
      { email, ...d.data(), creado: d.data()?.creado || Date.now() },
      { merge: true },
    )
  }
}
if (allow.empty) {
  console.warn('  ⚠ la allowlist está vacía: nadie podrá entrar al club hasta agregar miembros')
}

// ---------------------------------------------------------------------------
// 3. Datos. Copia doc por doc a clubs/{clubId}/<coleccion>/<mismo id>.
//    De config/club se saca `club` (nombre/ubicación), que ahora vive arriba.
// ---------------------------------------------------------------------------
let total = 0
for (const col of COLECCIONES) {
  const snap = await db.collection(col).get()
  if (snap.empty) {
    log(`${col}: vacía`)
    continue
  }
  log(`${col}: ${snap.size} documentos`)
  total += snap.size
  if (dryRun) continue

  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch()
    for (const d of docs.slice(i, i + 400)) {
      // En config/club el nombre y la ubicación ahora viven en el doc del club.
      const { club: _viejo, ...sinClub } = d.data()
      const data = col === 'config' && d.id === 'club' ? sinClub : d.data()
      batch.set(db.doc(`clubs/${clubId}/${col}/${d.id}`), data, { merge: true })
    }
    await batch.commit()
  }
}
log(`total copiado: ${total} documentos`)

// ---------------------------------------------------------------------------
// 4. Limpieza opcional del origen (solo con --limpiar, después de verificar).
// ---------------------------------------------------------------------------
if (opts.limpiar) {
  if (dryRun) {
    log('se borrarían las colecciones raíz:', [...COLECCIONES, 'allowlist'].join(', '))
  } else {
    for (const col of [...COLECCIONES, 'allowlist']) {
      await db.recursiveDelete(db.collection(col))
      console.log(`  borrada colección raíz ${col}`)
    }
  }
}

console.log(dryRun ? '✔ simulación terminada (no se escribió nada)' : '✔ migración terminada')
