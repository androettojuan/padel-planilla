// Capturas del README: npm run capturas
//
// Corre dentro de `firebase emulators:exec` (Auth + Firestore en puertos propios,
// para no chocar con otro emulador abierto), carga dos clubes de ejemplo y saca
// una foto de cada sección. Escribe docs/capturas/*.png. No toca producción.
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { repoRoot } from '../lib/admin.mjs'

const FIRESTORE_PORT = 8180
const AUTH_PORT = 9299
const APP_PORT = 5198
const APP = `http://localhost:${APP_PORT}`
const OUT = resolve(repoRoot, 'docs/capturas')

process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FIRESTORE_PORT}`
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AUTH_PORT}`
const { getDb } = await import('../lib/admin.mjs')
const db = getDb({ emulator: true })

const ENCARGADO = { email: 'encargado@ejemplo.com', nombre: 'Martín Gómez' }

// ---------------------------------------------------------------------------
// Datos de ejemplo
// ---------------------------------------------------------------------------

// Azar con semilla: cada corrida genera exactamente las mismas planillas.
let semilla = 20261019
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648)
const elegir = (lista) => lista[Math.floor(azar() * lista.length)]
const pad = (n) => String(n).padStart(2, '0')
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const HOY = new Date()
const hoy = key(HOY)
const diasAtras = (n) => {
  const d = new Date(HOY)
  d.setDate(d.getDate() - n)
  return d
}
let n = 0
const id = (p) => `${p}${++n}`

const JUGADORES = [
  'Ana Rossi', 'Beto Díaz', 'Caro Núñez', 'Diego Pérez', 'Euge Sosa', 'Facu Romero',
  'Gabi Torres', 'Hernán Ruiz', 'Inés Molina', 'Juli Acosta', 'Lucas Benítez',
  'Mica Herrera', 'Nico Ferreyra', 'Pato Castro', 'Sofi Medina', 'Tomi Ríos',
]

const FIADORES = ['Caro Núñez', 'Hernán Ruiz', 'Inés Molina', 'Tomi Ríos']

const PRODUCTOS = [
  { id: 'p1', nombre: 'Cerveza', precio: 6000, costo: 3200, cantidad: 34, minimo: 12 },
  { id: 'p2', nombre: 'Power grande', precio: 5000, costo: 2600, cantidad: 18, minimo: 6 },
  { id: 'p3', nombre: 'Power chico', precio: 3000, costo: 1500, cantidad: 4, minimo: 6 },
  { id: 'p4', nombre: 'Agua', precio: 2000, costo: 800, cantidad: 41, minimo: 12 },
  { id: 'p5', nombre: 'Gatorade', precio: 4000, costo: 2100, cantidad: 15, minimo: 6 },
  { id: 'p6', nombre: 'Alquiler paletas', precio: 3000 },
  { id: 'p7', nombre: 'Tubo de pelotas', precio: 12000, costo: 7500, cantidad: 2, minimo: 3 },
]
const PROD = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]))

const HORARIOS = [
  { id: 'h1', desde: '16:00', hasta: '17:30' },
  { id: 'h2', desde: '17:30', hasta: '19:00' },
  { id: 'h3', desde: '19:00', hasta: '20:30' },
  { id: 'h4', desde: '20:30', hasta: '22:00' },
  { id: 'h5', desde: '22:00', hasta: '23:30' },
]
const PRECIO_TURNO = 28000

const consumo = (jugador, pid, cantidad = 1, pago = 'contado', pagado = true) => ({
  id: id('k'),
  jugador,
  productoId: pid,
  nombre: PROD[pid].nombre,
  cantidad,
  precio: PROD[pid].precio,
  costo: PROD[pid].costo || 0,
  pagado,
  pago,
})

// Un turno por jugadores: cuatro líneas con su parte del precio.
const turnoJugadores = (nombres, pagos) =>
  nombres.map((jugador, i) => ({
    id: id('t'),
    jugador,
    monto: PRECIO_TURNO / 4,
    pagado: pagos[i] !== null,
    pago: pagos[i] || 'contado',
  }))

// Planilla de un día cualquiera del mes, armada al azar.
function diaAlAzar(canchas) {
  const turnos = {}
  const consumos = []
  for (const c of canchas) {
    for (const h of HORARIOS) {
      if (azar() < 0.35) continue
      const nombres = [...JUGADORES].sort(() => azar() - 0.5).slice(0, 4)
      // Anotan siempre los mismos pocos, como en un club de verdad.
      const pagos = nombres.map((nombre) =>
        FIADORES.includes(nombre) && azar() < 0.15 ? 'anotado' : elegir(['contado', 'mercado']),
      )
      turnos[`${c}__${h.id}`] = turnoJugadores(nombres, pagos)
      for (const nombre of nombres) {
        if (azar() < 0.4) consumos.push(consumo(nombre, elegir(['p1', 'p1', 'p2', 'p4', 'p5']), 1, elegir(['contado', 'mercado'])))
      }
    }
  }
  return { turnos, consumos, mostrador: [] }
}

// La planilla de hoy, a mano: es la que sale en la captura principal.
function planillaDeHoy() {
  const tubo = id('g')
  return {
    turnos: {
      c1__h1: turnoJugadores(['Ana Rossi', 'Beto Díaz', 'Caro Núñez', 'Diego Pérez'], ['contado', 'mercado', 'mercado', 'contado']),
      c2__h1: turnoJugadores(['Facu Romero', 'Gabi Torres', 'Hernán Ruiz', 'Inés Molina'], ['mercado', 'mercado', 'contado', 'anotado']),
      c1__h2: turnoJugadores(['Juli Acosta', 'Lucas Benítez', 'Mica Herrera', 'Nico Ferreyra'], ['contado', 'mercado', null, null]),
      c2__h3: turnoJugadores(['Euge Sosa', 'Pato Castro', 'Sofi Medina', 'Tomi Ríos'], [null, null, null, null]),
      c1__h4: [{ id: id('t'), jugador: 'Beto Díaz', monto: PRECIO_TURNO, pagado: false, pago: 'contado' }],
    },
    consumos: [
      consumo('Ana Rossi', 'p1', 2, 'contado'),
      consumo('Beto Díaz', 'p4', 1, 'mercado'),
      consumo('Inés Molina', 'p5', 1, 'anotado'),
      consumo('Juli Acosta', 'p2', 1, 'contado'),
      consumo('Mica Herrera', 'p1', 1, 'contado', false),
      consumo('Nico Ferreyra', 'p6', 1, 'contado', false),
      ...['Juli Acosta', 'Lucas Benítez', 'Mica Herrera', 'Nico Ferreyra'].map((jugador, i) => ({
        ...consumo(jugador, 'p7', 1, 'mercado', i < 2),
        precio: PROD.p7.precio / 4,
        costo: Math.round(PROD.p7.costo / 4),
        grupoId: tubo,
        parte: { n: i + 1, de: 4 },
      })),
      { ...consumo('', 'p4', 2, 'contado'), mostrador: true },
    ],
    mostrador: [],
  }
}

async function sembrar() {
  const ahora = Date.now()
  await db.recursiveDelete(db.collection('clubs'))
  await db.recursiveDelete(db.collection('superAdmins'))
  await db.doc(`superAdmins/${ENCARGADO.email}`).set({ email: ENCARGADO.email, creado: ahora })

  // --- Club principal: dos canchas, por jugadores, con un mes de movimiento ---
  const club = 'parque'
  await db.doc(`clubs/${club}`).set({ nombre: 'Padel del Parque', ubicacion: 'Río Cuarto · Córdoba', activo: true, creado: ahora })
  for (const email of [ENCARGADO.email, 'caja@ejemplo.com']) {
    await db.doc(`clubs/${club}/miembros/${email}`).set({ email, creado: ahora })
  }
  await db.doc(`clubs/${club}/config/club`).set({
    canchas: [
      { id: 'c1', nombre: 'Cancha 1' },
      { id: 'c2', nombre: 'Cancha 2' },
    ],
    horarios: HORARIOS,
    productos: PRODUCTOS.map(({ id, nombre, precio }) => ({ id, nombre, precio })),
    alias: 'padel.parque.mp',
  })
  for (const [i, nombre] of JUGADORES.entries()) {
    await db.doc(`clubs/${club}/jugadores/j${i + 1}`).set({ nombre, activo: true, creado: ahora - i * 864e5 })
  }

  await db.doc(`clubs/${club}/planillas/${hoy}`).set(planillaDeHoy())
  for (let d = 1; d < HOY.getDate(); d++) {
    await db.doc(`clubs/${club}/planillas/${key(diasAtras(d))}`).set(diaAlAzar(['c1', 'c2']))
  }

  for (const p of PRODUCTOS.filter((p) => p.cantidad !== undefined)) {
    await db.doc(`clubs/${club}/stock/${p.id}`).set({ cantidad: p.cantidad, costo: p.costo, minimo: p.minimo, actualizado: ahora })
  }
  for (const [dias, pid, cantidad] of [[2, 'p1', 48], [2, 'p4', 48], [6, 'p2', 24], [6, 'p5', 24], [9, 'p7', 6], [13, 'p3', 24]]) {
    await db.doc(`clubs/${club}/stockCompras/${id('s')}`).set({
      productoId: pid, nombre: PROD[pid].nombre, cantidad, costo: PROD[pid].costo,
      fecha: key(diasAtras(dias)), ts: ahora - dias * 864e5,
    })
  }

  for (const [dias, nombre, monto] of [[1, 'Luz', 186000], [5, 'Sueldo encargado de la noche', 420000], [8, 'Internet', 32000], [12, 'Agua', 41000], [15, 'Limpieza', 60000]]) {
    await db.doc(`clubs/${club}/gastos/${id('e')}`).set({ nombre, monto, fecha: key(diasAtras(dias)), ts: ahora - dias * 864e5 })
  }

  await db.doc(`clubs/${club}/fiadoCargos/${id('f')}`).set({
    nombre: 'Caro Núñez', nombreKey: 'caro nunez', concepto: 'Clase con profe', monto: 15000, fecha: key(diasAtras(4)), creado: ahora,
  })
  await db.doc(`clubs/${club}/fiadoPagos/${id('f')}`).set({
    nombre: 'Hernán Ruiz', nombreKey: 'hernan ruiz', monto: 10000, medio: 'mercado', fecha: key(diasAtras(3)), creado: ahora,
  })

  // --- Segundo club: cuatro canchas, por reserva, para ver el otro modo ---
  const norte = 'norte'
  await db.doc(`clubs/${norte}`).set({ nombre: 'Club Norte', ubicacion: 'Villa María · Córdoba', activo: true, creado: ahora })
  await db.doc(`clubs/${norte}/miembros/${ENCARGADO.email}`).set({ email: ENCARGADO.email, creado: ahora })
  await db.doc(`clubs/${norte}/config/club`).set({
    modoPlanilla: 'reserva',
    canchas: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, nombre: `Cancha ${i}` })),
    horarios: [
      { id: 'h1', desde: '18:00', hasta: '19:00' },
      { id: 'h2', desde: '19:00', hasta: '20:00' },
      { id: 'h3', desde: '20:00', hasta: '21:00' },
      { id: 'h4', desde: '21:00', hasta: '22:00' },
      { id: 'h5', desde: '22:00', hasta: '23:00' },
    ],
    productos: PRODUCTOS.slice(0, 5).map(({ id, nombre, precio }) => ({ id, nombre, precio })),
  })
  const reserva = (jugador, monto, pagos = []) => [{
    id: id('t'), jugador, monto,
    pagos: pagos.map(([nombre, m, pago]) => ({ id: id('pg'), nombre, monto: m, pago })),
  }]
  await db.doc(`clubs/${norte}/planillas/${hoy}`).set({
    turnos: {
      c1__h1: reserva('Ana Rossi', 24000, [['Ana Rossi', 24000, 'mercado']]),
      c2__h1: reserva('Diego Pérez', 24000, [['Diego Pérez', 12000, 'contado'], ['Euge Sosa', 12000, 'mercado']]),
      c3__h2: reserva('Facu Romero', 24000, [['Facu Romero', 6000, 'contado']]),
      c1__h3: reserva('Gabi Torres', 24000),
      c4__h3: reserva('Lucas Benítez', 24000, [['', 24000, 'anotado']]),
      c2__h4: reserva('Sofi Medina', 24000),
    },
    consumos: [consumo('Ana Rossi', 'p1', 2, 'mercado'), consumo('Facu Romero', 'p5', 1, 'contado', false)],
    mostrador: [],
  })
  await db.doc(`clubs/${norte}/jugadores/j1`).set({ nombre: 'Ana Rossi', activo: true, creado: ahora })
}

// ---------------------------------------------------------------------------
// Capturas
// ---------------------------------------------------------------------------

const TABLET = {
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
}

async function sesion(browser, { entrar = true, club = 'parque', ruta = 'planilla' } = {}) {
  const ctx = await browser.newContext(TABLET)
  // El club activo se recuerda en el navegador: lo dejamos elegido de entrada.
  await ctx.addInitScript((c) => localStorage.setItem('clubActivo', c), club)
  const page = await ctx.newPage()
  await page.goto(`${APP}/#/${ruta}`)
  if (entrar) {
    await page.waitForFunction(() => '__entrarComo' in window)
    await page.evaluate((u) => window.__entrarComo(u.email, u.nombre), ENCARGADO)
    await page.waitForSelector('.header')
  }
  return page
}

async function foto(page, nombre, { completa = false } = {}) {
  await page.evaluate(() => document.fonts.ready)
  // El aviso de "emulador local" es del entorno de prueba, no de la app.
  await page.addStyleTag({ content: '.banner--warn { display: none !important; }' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: completa })
  console.log('  ', nombre)
}

async function capturas() {
  const vite = await createServer({
    root: repoRoot,
    logLevel: 'error',
    server: { port: APP_PORT, strictPort: true },
  })
  await vite.listen()
  // El idioma del navegador decide cómo se muestra el campo de fecha (dd/mm/aaaa).
  const browser = await chromium.launch({ channel: 'chromium', args: ['--lang=es-AR'], env: { ...process.env, LANGUAGE: 'es_AR' } })
  try {
    const login = await sesion(browser, { entrar: false })
    await login.waitForSelector('.login')
    await foto(login, 'login')

    const page = await sesion(browser)
    await page.waitForSelector('.layout__courts')
    await foto(page, 'planilla')
    await page.locator('.layout__consumos').screenshot({ path: `${OUT}/planilla-paneles.png` })
    console.log('   planilla-paneles')

    for (const ruta of ['stock', 'config', 'clubes']) {
      await page.goto(`${APP}/#/${ruta}`)
      await page.waitForSelector('.pantalla')
      // En Clubes se abre uno, para que se vea quién entra.
      if (ruta === 'clubes') await page.locator('.admin-club', { hasText: 'Padel del Parque' }).click()
      await foto(page, ruta, { completa: true })
    }

    await page.goto(`${APP}/#/finanzas`)
    await page.waitForSelector('.pantalla')
    await foto(page, 'finanzas-mes', { completa: true })
    for (const [boton, nombre] of [['Gastos', 'finanzas-gastos'], ['Fiados', 'finanzas-fiados']]) {
      await page.getByRole('button', { name: boton, exact: true }).click()
      if (boton === 'Fiados') await page.getByText('Caro Núñez', { exact: true }).click()
      await foto(page, nombre, { completa: true })
    }

    const norte = await sesion(browser, { club: 'norte' })
    await norte.waitForSelector('.layout__courts')
    await foto(norte, 'planilla-reserva')
  } finally {
    await browser.close()
    await vite.close()
  }
}

await mkdir(OUT, { recursive: true })
process.env.VITE_USE_EMULATOR = '1'
process.env.VITE_EMULATOR_FIRESTORE_PORT = String(FIRESTORE_PORT)
process.env.VITE_EMULATOR_AUTH_PORT = String(AUTH_PORT)
await sembrar()
await capturas()
process.exit(0)
