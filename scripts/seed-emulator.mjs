// Carga en el emulador local el dump generado por dump-prod.mjs.
//
//   firebase emulators:start          (en otra terminal)
//   node scripts/seed-emulator.mjs [--in=firestore-dump/latest.json] [--reset]
//
// `--reset` borra lo que haya en el emulador antes de cargar.
// Además marca como super admin a los emails de SUPER_ADMINS (o --super=a@b.com)
// para poder probar el panel de administración sin tocar producción.
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDb, args, repoRoot } from './lib/admin.mjs'
import { writeAll } from './lib/dump-format.mjs'

const opts = args()
const inPath = resolve(repoRoot, opts.in || 'firestore-dump/latest.json')

if (!existsSync(inPath)) {
  console.error(`No existe ${inPath}. Corré primero: node scripts/dump-prod.mjs`)
  process.exit(1)
}

const db = getDb({ emulator: true })

if (opts.reset) {
  const cols = await db.listCollections()
  for (const col of cols) await db.recursiveDelete(col)
  console.log(`  emulador vaciado (${cols.length} colecciones)`)
}

const docs = JSON.parse(readFileSync(inPath, 'utf8'))
const n = await writeAll(db, docs)
console.log(`✔ ${n} documentos cargados desde ${inPath}`)

const supers = String(opts.super || process.env.SUPER_ADMINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

for (const email of supers) {
  await db.doc(`superAdmins/${email}`).set({ email, creado: Date.now() }, { merge: true })
  console.log(`  super admin: ${email}`)
}
