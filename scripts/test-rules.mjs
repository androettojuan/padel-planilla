// Prueba las reglas de Firestore contra el emulador. Verifica lo esencial del
// modelo multi-club: que un club no pueda ver ni tocar los datos de otro, y que
// solo el super admin dé de alta usuarios.
//
//   firebase emulators:start --only firestore     (en otra terminal)
//   node scripts/test-rules.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { collectionGroup } from 'firebase/firestore'
import { repoRoot } from './lib/admin.mjs'

const env = await initializeTestEnvironment({
  projectId: 'reglas-test',
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: readFileSync(resolve(repoRoot, 'firestore.rules'), 'utf8'),
  },
})

const ANA = 'ana@club-a.com'
const BETO = 'beto@club-b.com'
const JEFE = 'jefe@planilla.app'

// Datos base, escritos salteando las reglas.
await env.clearFirestore()
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'superAdmins', JEFE), { email: JEFE })
  for (const [club, email] of [
    ['club-a', ANA],
    ['club-b', BETO],
  ]) {
    await setDoc(doc(db, 'clubs', club), { nombre: club, activo: true })
    await setDoc(doc(db, 'clubs', club, 'miembros', email), { email })
    await setDoc(doc(db, 'clubs', club, 'planillas', '2026-07-01'), { turnos: {} })
    await setDoc(doc(db, 'clubs', club, 'config', 'club'), { canchas: [] })
  }
})

const como = (email) => env.authenticatedContext(email.replace(/\W/g, ''), { email }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

const casos = []
const test = (nombre, fn) => casos.push([nombre, fn])

test('un miembro lee la planilla de su club', () =>
  assertSucceeds(getDoc(doc(como(ANA), 'clubs/club-a/planillas/2026-07-01'))))

test('un miembro escribe en la planilla de su club', () =>
  assertSucceeds(setDoc(doc(como(ANA), 'clubs/club-a/planillas/2026-07-02'), { turnos: {} })))

test('un miembro NO lee la planilla de otro club', () =>
  assertFails(getDoc(doc(como(ANA), 'clubs/club-b/planillas/2026-07-01'))))

test('un miembro NO escribe en otro club', () =>
  assertFails(setDoc(doc(como(ANA), 'clubs/club-b/planillas/2026-07-03'), { turnos: {} })))

test('un miembro carga un gasto fijo de su club', () =>
  assertSucceeds(
    setDoc(doc(como(ANA), 'clubs/club-a/gastosFijos/luz'), { nombre: 'Luz', monto: 70000 }),
  ))

test('un miembro NO carga el pago de un gasto en otro club', () =>
  assertFails(
    setDoc(doc(como(ANA), 'clubs/club-b/gastosPagos/p1'), { gastoId: 'luz', mes: '2026-07' }),
  ))

test('un miembro NO lee los jugadores de otro club', () =>
  assertFails(getDocs(collection(como(BETO), 'clubs/club-a/jugadores'))))

test('un miembro NO se agrega a sí mismo a otro club', () =>
  assertFails(setDoc(doc(como(ANA), 'clubs/club-b/miembros', ANA), { email: ANA })))

test('un miembro NO da de alta usuarios ni en su propio club', () =>
  assertFails(setDoc(doc(como(ANA), 'clubs/club-a/miembros/otro@x.com'), { email: 'otro@x.com' })))

test('un miembro NO se quita a sí mismo del club', () =>
  assertFails(deleteDoc(doc(como(ANA), 'clubs/club-a/miembros', ANA))))

test('un miembro edita el nombre de su club', () =>
  assertSucceeds(setDoc(doc(como(ANA), 'clubs/club-a'), { nombre: 'Club A', ubicacion: 'x' }, { merge: true })))

test('un miembro NO desactiva su club', () =>
  assertFails(setDoc(doc(como(ANA), 'clubs/club-a'), { activo: false }, { merge: true })))

test('un miembro NO crea clubes', () =>
  assertFails(setDoc(doc(como(ANA), 'clubs/club-trucho'), { nombre: 'trucho' })))

test('el super admin crea clubes', () =>
  assertSucceeds(setDoc(doc(como(JEFE), 'clubs/club-c'), { nombre: 'Club C', activo: true })))

test('el super admin da de alta usuarios', () =>
  assertSucceeds(setDoc(doc(como(JEFE), 'clubs/club-a/miembros/nuevo@x.com'), { email: 'nuevo@x.com' })))

test('el super admin NO lee la planilla de un club del que no es miembro', () =>
  assertFails(getDoc(doc(como(JEFE), 'clubs/club-a/planillas/2026-07-01'))))

test('cada uno lee su propia marca de super admin', () =>
  assertSucceeds(getDoc(doc(como(JEFE), 'superAdmins', JEFE))))

test('nadie lee la marca de super admin de otro', () =>
  assertFails(getDoc(doc(como(ANA), 'superAdmins', JEFE))))

test('nadie se hace super admin a sí mismo', () =>
  assertFails(setDoc(doc(como(ANA), 'superAdmins', ANA), { email: ANA })))

test('un usuario consulta a qué clubes pertenece', () =>
  assertSucceeds(getDocs(query(collectionGroup(como(ANA), 'miembros'), where('email', '==', ANA)))))

test('un usuario NO consulta las membresías de otro', () =>
  assertFails(getDocs(query(collectionGroup(como(ANA), 'miembros'), where('email', '==', BETO)))))

test('sin sesión no se lee nada', () =>
  assertFails(getDoc(doc(anon(), 'clubs/club-a/planillas/2026-07-01'))))

let fallos = 0
for (const [nombre, fn] of casos) {
  try {
    await fn()
    console.log(`  ✔ ${nombre}`)
  } catch (err) {
    fallos++
    console.log(`  ✘ ${nombre}\n      ${err.message.split('\n')[0]}`)
  }
}

await env.cleanup()
console.log(fallos ? `\n${fallos} de ${casos.length} pruebas fallaron` : `\n✔ ${casos.length} pruebas OK`)
process.exit(fallos ? 1 : 0)
