// Restaura un dump (el que genera dump-prod.mjs) sobre una base. Es la vuelta
// atrás si una migración sale mal: deja los documentos como estaban el día del
// backup.
//
//   node scripts/restore-prod.mjs --emulator                    ← ensayo local
//   node scripts/restore-prod.mjs --in=firestore-dump/x.json --si   ← PRODUCCIÓN
//
// Contra producción exige `--si` escrito a mano: es una escritura masiva y no
// tiene que poder dispararse por tener una flecha arriba en la terminal.
//
// Por defecto solo escribe lo que hay en el dump y no toca lo demás; así una
// restauración nunca borra datos cargados después del backup. Con `--exacto`
// además borra lo que no figura en el dump, dejando la base igual a esa foto.
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { getDb, args, repoRoot } from './lib/admin.mjs'
import { writeAll, dumpAll } from './lib/dump-format.mjs'

const opts = args()
const inPath = resolve(repoRoot, opts.in || 'firestore-dump/latest.json')
const emulador = !!opts.emulator

if (!existsSync(inPath)) {
  console.error(`No existe ${inPath}`)
  process.exit(1)
}

const docs = JSON.parse(readFileSync(inPath, 'utf8'))
const total = Object.keys(docs).length
const colecciones = [...new Set(Object.keys(docs).map((p) => p.split('/')[0]))]

console.log(`\nArchivo:      ${inPath}`)
console.log(`Documentos:   ${total}`)
console.log(`Colecciones:  ${colecciones.join(', ')}`)
console.log(`Destino:      ${emulador ? 'EMULADOR local' : '*** PRODUCCIÓN ***'}`)
console.log(`Modo:         ${opts.exacto ? 'exacto (borra lo que no esté en el dump)' : 'solo escribe lo del dump'}`)

if (!emulador) {
  if (!opts.si) {
    console.error('\nFalta --si para escribir en producción. Nada que hacer.')
    process.exit(1)
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const r = await rl.question('\nEscribí RESTAURAR para confirmar: ')
  rl.close()
  if (r.trim() !== 'RESTAURAR') {
    console.error('Cancelado: no se escribió nada.')
    process.exit(1)
  }
}

const db = getDb({ emulator: emulador })

// Antes de escribir, una foto de cómo está la base ahora. Restaurar sobre algo
// que no se guardó primero es la forma más común de perder datos de verdad.
const antes = await dumpAll(db)
const salvavidas = resolve(repoRoot, `firestore-dump/antes-de-restaurar-${Date.now()}.json`)
const { writeFileSync } = await import('node:fs')
writeFileSync(salvavidas, JSON.stringify(antes, null, 2))
console.log(`\n  copia de lo que había ahora → ${salvavidas} (${Object.keys(antes).length} documentos)`)

if (opts.exacto) {
  const sobran = Object.keys(antes).filter((p) => !(p in docs))
  for (let i = 0; i < sobran.length; i += 400) {
    const batch = db.batch()
    for (const path of sobran.slice(i, i + 400)) batch.delete(db.doc(path))
    await batch.commit()
  }
  if (sobran.length) console.log(`  borrados ${sobran.length} documentos que no estaban en el dump`)
}

const n = await writeAll(db, docs)
console.log(`\n✔ ${n} documentos restaurados`)
console.log('  Revisá la app antes de darlo por bueno.')
