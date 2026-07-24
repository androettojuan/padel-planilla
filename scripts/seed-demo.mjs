// Datos de ejemplo para el emulador, con el modelo multi-club ya armado.
// Sirve para probar la app sin tocar producción y sin necesitar credenciales.
//
//   firebase emulators:start                (en otra terminal)
//   node scripts/seed-demo.mjs --super=tu-email@gmail.com
//
// Crea dos clubes (uno con movimiento, otro recién abierto), el super admin y
// las cuentas de prueba en el emulador de Auth para que aparezcan en el popup
// de login.
import { getDb, args } from './lib/admin.mjs'
import { getAuth } from 'firebase-admin/auth'

const opts = args()
const superEmail = (opts.super || 'androettop@gmail.com').toLowerCase()
const operadorEmail = (opts.operador || 'operador@example.com').toLowerCase()

const db = getDb({ emulator: true })

// --- Super admin -----------------------------------------------------------
await db.doc(`superAdmins/${superEmail}`).set({ email: superEmail, creado: Date.now() })

// --- Club con datos --------------------------------------------------------
const CAREST = {
  nombre: 'Carest Padel',
  ubicacion: 'General Levalle · Cba.',
  activo: true,
  creado: Date.now(),
}
await db.doc('clubs/carest').set(CAREST)
for (const email of [superEmail, operadorEmail]) {
  await db.doc(`clubs/carest/miembros/${email}`).set({ email, creado: Date.now() })
}
await db.doc('clubs/carest/config/club').set({
  canchas: [
    { id: 'c1', nombre: 'Cancha 1' },
    { id: 'c2', nombre: 'Cancha 2' },
  ],
  horarios: [
    { id: 'h1', desde: '18:00', hasta: '19:30' },
    { id: 'h2', desde: '19:30', hasta: '21:00' },
    { id: 'h3', desde: '21:00', hasta: '22:30' },
  ],
  productos: [
    { id: 'p1', nombre: 'Cerveza', precio: 6000 },
    { id: 'p2', nombre: 'Agua', precio: 2000 },
    { id: 'p3', nombre: 'Gatorade', precio: 4000 },
    { id: 'p4', nombre: 'Tubo de pelotas', precio: 12000 },
  ],
})

const JUGADORES = ['Ana Rossi', 'Beto Díaz', 'Caro Núñez', 'Diego Pérez', 'Euge Sosa']
for (const [i, nombre] of JUGADORES.entries()) {
  await db.doc(`clubs/carest/jugadores/j${i + 1}`).set({ nombre, activo: true, creado: Date.now() })
}

// Fecha de hoy y de ayer, para que la planilla del día ya tenga movimiento.
const hoy = new Date()
const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ayer = new Date(hoy)
ayer.setDate(ayer.getDate() - 1)

await db.doc(`clubs/carest/planillas/${key(hoy)}`).set({
  turnos: {
    c1__h1: [
      { id: 't1', jugador: 'Ana Rossi', monto: 6000, pagado: true, pago: 'contado' },
      { id: 't2', jugador: 'Beto Díaz', monto: 6000, pagado: true, pago: 'mercado' },
      { id: 't3', jugador: 'Caro Núñez', monto: 6000, pagado: true, pago: 'anotado' },
      { id: 't4', jugador: 'Diego Pérez', monto: 6000, pagado: false, pago: 'contado' },
    ],
    c2__h2: [{ id: 't5', jugador: 'Euge Sosa', monto: 24000, pagado: false, pago: 'contado' }],
  },
  consumos: [
    {
      id: 'k1',
      jugador: 'Ana Rossi',
      productoId: 'p1',
      nombre: 'Cerveza',
      cantidad: 2,
      precio: 6000,
      pagado: true,
      pago: 'contado',
    },
    {
      id: 'k2',
      jugador: 'Caro Núñez',
      productoId: 'p2',
      nombre: 'Agua',
      cantidad: 1,
      precio: 2000,
      pagado: true,
      pago: 'anotado',
    },
  ],
  mostrador: [],
})

await db.doc(`clubs/carest/planillas/${key(ayer)}`).set({
  turnos: {
    c1__h2: [
      { id: 't6', jugador: 'Beto Díaz', monto: 7000, pagado: true, pago: 'contado' },
      { id: 't7', jugador: 'Ana Rossi', monto: 7000, pagado: true, pago: 'anotado' },
    ],
  },
  consumos: [],
  mostrador: [],
})

// Fiados: Caro debe, Beto ya pagó una parte.
await db.doc('clubs/carest/fiadoCargos/cg1').set({
  nombre: 'Caro Núñez',
  nombreKey: 'caro nunez',
  concepto: 'Alquiler de paletas',
  monto: 3000,
  fecha: key(ayer),
  creado: Date.now(),
})
await db.doc('clubs/carest/fiadoPagos/pg1').set({
  nombre: 'Ana Rossi',
  nombreKey: 'ana rossi',
  monto: 5000,
  medio: 'contado',
  fecha: key(hoy),
  creado: Date.now(),
})

// --- Club recién creado, sin datos ----------------------------------------
await db.doc('clubs/club-norte').set({
  nombre: 'Club Norte',
  ubicacion: 'Villa María · Cba.',
  activo: true,
  creado: Date.now(),
})
await db.doc(`clubs/club-norte/miembros/${superEmail}`).set({ email: superEmail, creado: Date.now() })

// --- Cuentas en el emulador de Auth, para elegirlas en el popup de login ----
const auth = getAuth()
for (const [email, nombre] of [
  [superEmail, 'Super Admin'],
  [operadorEmail, 'Operador del club'],
  ['ajeno@example.com', 'Usuario sin club'],
]) {
  try {
    await auth.createUser({ email, displayName: nombre, emailVerified: true })
  } catch (err) {
    if (err.code !== 'auth/email-already-exists') throw err
  }
}

console.log(`✔ datos de ejemplo cargados en el emulador
   super admin : ${superEmail}      (clubes: Carest Padel + Club Norte)
   operador    : ${operadorEmail}   (solo Carest Padel)
   sin permisos: ajeno@example.com  (no pertenece a ningún club)`)
