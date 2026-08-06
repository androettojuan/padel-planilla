// Copia la base de producción a un archivo JSON local (no modifica nada).
//
//   node scripts/dump-prod.mjs                 → firestore-dump/latest.json
//   node scripts/dump-prod.mjs --out=x.json    → archivo a elección
//
// El dump queda fuera de git: es la copia de trabajo para sembrar el emulador.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { getDb, args, repoRoot } from './lib/admin.mjs'
import { dumpAll } from './lib/dump-format.mjs'

const opts = args()
const out = resolve(repoRoot, opts.out || 'firestore-dump/latest.json')

const db = getDb({ emulator: false })

let n = 0
const docs = await dumpAll(db, {
  onDoc: () => {
    n++
    if (n % 100 === 0) process.stdout.write(`\r  ${n} documentos…`)
  },
})

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(docs, null, 2))

const cols = new Set(Object.keys(docs).map((p) => p.split('/')[0]))
console.log(`\n✔ ${Object.keys(docs).length} documentos → ${out}`)
console.log(`  colecciones raíz: ${[...cols].join(', ')}`)
