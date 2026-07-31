// Verifica una migración a multi-club: que lo que quedó bajo clubs/{clubId} sea
// exactamente lo que había en las colecciones raíz, y que la app nueva saque los
// mismos números de esos datos que la vieja sacaba de los originales.
//
//   node scripts/check-migracion.mjs --emulator          ← después del ensayo
//   node scripts/check-migracion.mjs                     ← contra PRODUCCIÓN (solo lee)
//
// Correrlo apenas termina la migración, ANTES de que alguien use la app nueva:
// desde el primer turno que se cargue, la base migrada se separa de las
// colecciones viejas con todo derecho y las diferencias que reporte dejan de
// significar algo.
//
// Opciones: --club=carest
//
// No escribe nada, ni en el emulador ni en producción.
import { register } from 'node:module'
import { getDb, args } from './lib/admin.mjs'
import { encode } from './lib/dump-format.mjs'

// Los cálculos se hacen con el código de la app, no con una copia: si mañana
// cambia cómo se suma algo, esta verificación cambia con él.
register('./lib/resolver-app.mjs', import.meta.url)
const { resumenMensual } = await import('../src/utils/resumen.js')
const { buildSaldos } = await import('../src/utils/saldos.js')

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
const db = getDb({ emulator: !!opts.emulator })

const problemas = []
const falla = (msg) => {
  problemas.push(msg)
  console.log(`  ✗ ${msg}`)
}

const leerCol = async (ruta) => {
  const snap = await db.collection(ruta).get()
  return new Map(snap.docs.map((d) => [d.id, encode(d.data())]))
}

/**
 * Texto comparable de un documento, con las claves ordenadas en todos los
 * niveles. Firestore no garantiza el orden de los campos al leerlos y no
 * significa nada, así que compararlos tal cual daría diferencias que no lo son.
 */
function estable(valor) {
  if (Array.isArray(valor)) return `[${valor.map(estable).join(',')}]`
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${estable(valor[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(valor)
}

// ---------------------------------------------------------------------------
// 1. Copia fiel: mismos documentos, con los mismos campos.
//    Única diferencia esperada: config/club deja atrás `club` (nombre y
//    ubicación), que en el modelo nuevo vive en el documento del club.
// ---------------------------------------------------------------------------
console.log('\n1. La copia es fiel')
const origenPorCol = new Map()
for (const col of COLECCIONES) origenPorCol.set(col, await leerCol(col))
const totalOrigen = [...origenPorCol.values()].reduce((s, m) => s + m.size, 0)

// Sin datos viejos no hay nada contra qué comparar: o la base ya se limpió, o
// nació directamente en el modelo nuevo. Los chequeos que sí tienen sentido
// (que el club esté armado) se corren igual.
const hayOrigen = totalOrigen > 0
if (!hayOrigen) {
  console.log('  · no quedan colecciones raíz: esta base ya está en el modelo nuevo')
}

for (const col of hayOrigen ? COLECCIONES : []) {
  const origen = origenPorCol.get(col)
  const destino = await leerCol(`clubs/${clubId}/${col}`)
  if (!origen.size && !destino.size) continue

  const faltan = [...origen.keys()].filter((id) => !destino.has(id))
  if (faltan.length) falla(`${col}: faltan ${faltan.length} documentos (${faltan.slice(0, 3).join(', ')}…)`)

  let distintos = 0
  for (const [id, datos] of origen) {
    if (!destino.has(id)) continue
    const esperado = col === 'config' && id === 'club' ? sinClub(datos) : datos
    if (estable(esperado) !== estable(destino.get(id))) distintos++
  }
  if (distintos) falla(`${col}: ${distintos} documentos con contenido distinto`)
  if (!faltan.length && !distintos) console.log(`  ✓ ${col}: ${origen.size} documentos iguales`)
}
if (hayOrigen) console.log(`  origen: ${totalOrigen} documentos en total`)

function sinClub(data) {
  const { club: _fuera, ...resto } = data
  return resto
}

// ---------------------------------------------------------------------------
// 2. El club quedó armado: documento, nombre y miembros que puedan entrar.
// ---------------------------------------------------------------------------
console.log('\n2. El club quedó armado')
const clubDoc = await db.doc(`clubs/${clubId}`).get()
if (!clubDoc.exists) falla(`no existe el documento clubs/${clubId}`)
else {
  const { nombre, activo } = clubDoc.data()
  console.log(`  ✓ clubs/${clubId}: ${nombre}${activo === false ? ' (INACTIVO)' : ''}`)
  if (activo === false) falla('el club quedó marcado como inactivo: nadie lo va a ver')
}

const miembros = await leerCol(`clubs/${clubId}/miembros`)
if (!miembros.size) falla('el club no tiene miembros: nadie va a poder entrar')
else console.log(`  ✓ miembros: ${miembros.size}`)
const allowlist = await leerCol('allowlist')
const sinMigrar = [...allowlist.keys()].filter((email) => !miembros.has(email))
if (sinMigrar.length) falla(`emails de la allowlist que no quedaron como miembros: ${sinMigrar.join(', ')}`)

// ---------------------------------------------------------------------------
// 3. Los números no cambian: el resumen de cada mes y los saldos de fiado
//    calculados sobre los datos migrados dan lo mismo que sobre los originales.
//    Es la prueba de fuego: recorre los datos reales con el código de la app.
// ---------------------------------------------------------------------------
console.log('\n3. Los números dan igual')
const planillasDe = async (ruta) =>
  (await db.collection(ruta).get()).docs.map((d) => ({ dateKey: d.id, data: encode(d.data()) }))

const destinoPlanillas = await planillasDe(`clubs/${clubId}/planillas`)
const pagosDestino = [...(await leerCol(`clubs/${clubId}/fiadoPagos`)).values()]
const meses = [...new Set(destinoPlanillas.map((p) => p.dateKey.slice(0, 7)))].sort()
const delMes = (lista, mes) => lista.filter((p) => p.dateKey.startsWith(mes))

const saldosDe = async (planillas, pagos, base) =>
  buildSaldos(
    planillas,
    pagos,
    [...(await leerCol(`${base}jugadores`)).values()],
    [...(await leerCol(`${base}fiadoCargos`)).values()],
    [...(await leerCol(`${base}fiadoCortes`)).values()],
  )

const sb = await saldosDe(destinoPlanillas, pagosDestino, `clubs/${clubId}/`)

if (hayOrigen) {
  const origenPlanillas = await planillasDe('planillas')
  const pagosOrigen = [...(await leerCol('fiadoPagos')).values()]

  let mesesOk = 0
  for (const mes of meses) {
    const a = resumenMensual(delMes(origenPlanillas, mes), pagosOrigen)
    const b = resumenMensual(delMes(destinoPlanillas, mes), pagosDestino)
    const campos = ['contado', 'mercado', 'anotado', 'pendiente', 'total']
    const dif = campos.filter((c) => a[c] !== b[c])
    if (dif.length) falla(`${mes}: no coinciden ${dif.map((c) => `${c} (${a[c]} vs ${b[c]})`).join(', ')}`)
    else mesesOk++
  }
  console.log(`  ✓ ${mesesOk}/${meses.length} meses con los mismos totales`)

  const sa = await saldosDe(origenPlanillas, pagosOrigen, '')
  if (sa.totalDeuda !== sb.totalDeuda) {
    falla(`la deuda total no coincide: ${sa.totalDeuda} vs ${sb.totalDeuda}`)
  } else {
    console.log(`  ✓ deuda de fiados igual: ${sa.totalDeuda}`)
  }
} else {
  console.log('  · sin datos viejos con qué comparar; van los números que lee la app hoy')
}

// Los números que la app nueva muestra sobre los datos migrados, para poder
// cotejarlos a ojo contra lo que el club ve hoy en pantalla.
for (const mes of meses.slice(-3)) {
  const r = resumenMensual(delMes(destinoPlanillas, mes), pagosDestino)
  console.log(
    `    ${mes}: facturado ${r.total} · contado ${r.contado} · mercado ${r.mercado} · ` +
      `anotado ${r.anotado} · sin cobrar ${r.pendiente}`,
  )
}
const deben = sb.saldos.filter((s) => s.saldo > 0)
console.log(`    fiados: deben ${sb.totalDeuda} entre ${deben.length} cuentas`)

// ---------------------------------------------------------------------------
// 4. Qué se va a ver distinto en la app nueva. No son errores: son cambios de
//    esta versión que conviene tener presentes antes de publicarla.
// ---------------------------------------------------------------------------
console.log('\n4. Cambios esperables con la versión nueva')
const archivados = await leerCol('fiadoArchivados')
if (archivados.size) {
  console.log(
    `  · ${archivados.size} cuentas archivadas: la versión nueva no usa el archivado, ` +
      'así que vuelven a listarse entre las saldadas (no suman deuda).',
  )
}
const conMostradorViejo = destinoPlanillas.filter((p) => (p.data?.mostrador || []).length).length
if (conMostradorViejo) {
  console.log(
    `  · ${conMostradorViejo} planillas con cuentas de mostrador del modelo viejo: ` +
      'se siguen leyendo y sumando igual.',
  )
}
const consumos = destinoPlanillas.flatMap((p) => p.data?.consumos || [])
const sinCosto = consumos.filter((c) => c.costo === undefined || c.costo === null).length
if (sinCosto) {
  console.log(
    `  · ${sinCosto} de ${consumos.length} consumos sin costo cargado (son anteriores al stock): ` +
      'el resumen no calcula ganancia hasta que haya ventas con costo.',
  )
}
const config = (await leerCol(`clubs/${clubId}/config`)).get('club') || {}
console.log(`  · modo de planilla: ${config.modoPlanilla || 'jugadores (por defecto)'}`)
console.log(`  · alias para transferencias: ${config.alias ? config.alias : 'sin cargar'}`)

// ---------------------------------------------------------------------------
console.log(
  problemas.length
    ? `\n✗ ${problemas.length} problema(s). NO publicar hasta resolverlos.`
    : '\n✔ Todo verificado: la migración es fiel y los números no cambian.',
)
process.exit(problemas.length ? 1 : 0)
