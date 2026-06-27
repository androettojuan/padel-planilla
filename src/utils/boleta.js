import { formatMoney, formatDateNumeric, todayKey } from './helpers'

// Genera la boleta de fiado de una persona como imagen PNG para enviar por
// WhatsApp. Se dibuja todo a mano sobre un <canvas> (sin dependencias) con el
// detalle de lo que debe: cargos, pagos a cuenta y saldo final.

const NEGOCIO = 'CAREST PADEL'
const SUBTITULO = 'General Levalle - Cba.'

const COLORS = {
  brand: '#d11f2a', // rojo de la marca
  ink: '#16181d',
  sub: '#6b7280',
  line: '#e6e8ec',
  pago: '#15803d',
  bg: '#ffffff',
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

// Aplica los pagos contra los cargos más viejos (FIFO) y devuelve solo los
// cargos que siguen impagos. Lo ya saldado desaparece de la boleta (sin líneas
// en negativo); si se pagó todo, la lista queda vacía. El último cargo parcial
// se muestra con el monto que resta pagar.
function cargosPendientes(saldo) {
  const cargos = (saldo.cargos || []).slice().sort((a, b) => (a.dateKey || '').localeCompare(b.dateKey || ''))
  let pool = (saldo.pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const out = []
  for (const c of cargos) {
    const monto = Number(c.monto) || 0
    if (pool >= monto) {
      pool -= monto // cargo totalmente saldado: no se muestra
      continue
    }
    out.push({ ...c, monto: monto - pool }) // resto impago del cargo
    pool = 0
  }
  return out
}

// Recorta un texto agregando "…" para que entre en `maxWidth` px.
function truncar(ctx, texto, maxWidth) {
  if (ctx.measureText(texto).width <= maxWidth) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

// Dibuja la boleta y devuelve el <canvas> listo para exportar.
export function boletaCanvas(saldo) {
  const cargos = cargosPendientes(saldo)
  const movs = cargos.length

  const dpr = 2
  const W = 560
  const pad = 28
  const headerH = 104
  const rowH = 32

  // Alto dinámico según la cantidad de movimientos.
  const yMovsStart = headerH + 32 + 34 + 52 + 28
  const H = yMovsStart + movs * rowH + 20 + 70 + 44

  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'alphabetic'

  // Fondo
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  // Header de marca
  ctx.fillStyle = COLORS.brand
  ctx.fillRect(0, 0, W, headerH)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.font = `800 34px ${FONT}`
  ctx.fillText(NEGOCIO, pad, 52)
  ctx.font = `600 15px ${FONT}`
  ctx.globalAlpha = 0.92
  ctx.fillText(SUBTITULO, pad, 78)
  ctx.globalAlpha = 1

  let y = headerH + 38

  // Título y fecha de emisión
  ctx.fillStyle = COLORS.ink
  ctx.font = `700 20px ${FONT}`
  ctx.fillText('Detalle de fiado', pad, y)
  ctx.fillStyle = COLORS.sub
  ctx.font = `500 13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`Emitida ${formatDateNumeric(todayKey())}`, W - pad, y)
  ctx.textAlign = 'left'

  // Nombre del deudor
  y += 38
  ctx.fillStyle = COLORS.ink
  ctx.font = `800 24px ${FONT}`
  ctx.fillText(saldo.nombre || 'Sin nombre', pad, y)

  // Encabezado de la tabla
  y += 36
  const xFecha = pad
  const xConcepto = pad + 66
  const xMonto = W - pad
  const concMax = xMonto - xConcepto - 70
  ctx.font = `700 12px ${FONT}`
  ctx.fillStyle = COLORS.sub
  ctx.fillText('FECHA', xFecha, y)
  ctx.fillText('CONCEPTO', xConcepto, y)
  ctx.textAlign = 'right'
  ctx.fillText('MONTO', xMonto, y)
  ctx.textAlign = 'left'

  // Línea bajo el encabezado
  y += 8
  ctx.strokeStyle = COLORS.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(W - pad, y)
  ctx.stroke()

  // Filas: primero los cargos, después los pagos a cuenta
  y += rowH - 8
  const filaTexto = (fecha, concepto, monto, color) => {
    ctx.fillStyle = COLORS.sub
    ctx.font = `500 13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(fecha, xFecha, y)
    ctx.fillStyle = color
    ctx.font = `500 14px ${FONT}`
    ctx.fillText(truncar(ctx, concepto, concMax), xConcepto, y)
    ctx.font = `600 14px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(monto, xMonto, y)
    ctx.textAlign = 'left'
    y += rowH
  }

  for (const c of cargos) {
    filaTexto(formatDateNumeric(c.dateKey), c.concepto, formatMoney(c.monto), COLORS.ink)
  }

  // Línea y total
  y -= rowH - 12
  ctx.strokeStyle = COLORS.line
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(W - pad, y)
  ctx.stroke()

  y += 44
  ctx.fillStyle = COLORS.ink
  ctx.font = `700 18px ${FONT}`
  ctx.fillText('Saldo adeudado', pad, y)
  ctx.fillStyle = COLORS.brand
  ctx.font = `800 26px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(formatMoney(Math.max(0, saldo.saldo)), xMonto, y)
  ctx.textAlign = 'left'

  // Pie
  y += 36
  ctx.fillStyle = COLORS.sub
  ctx.font = `500 12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('¡Gracias! Cualquier duda, avisanos.', W / 2, y)
  ctx.textAlign = 'left'

  return canvas
}

// Genera y descarga la boleta de la persona como PNG.
export function descargarBoleta(saldo) {
  const canvas = boletaCanvas(saldo)
  const nombre = (saldo.nombre || 'cliente').trim().replace(/[^\w.-]+/g, '_')
  const finish = (url, revoke) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `boleta-${nombre}-${todayKey()}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (blob) finish(URL.createObjectURL(blob), true)
      else finish(canvas.toDataURL('image/png'), false)
    }, 'image/png')
  } else {
    finish(canvas.toDataURL('image/png'), false)
  }
}
