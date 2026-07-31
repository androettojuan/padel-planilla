import { formatMoney, formatDateNumeric, todayKey } from './helpers'
import { aplicarPagosFIFO } from './saldos'

// Genera la boleta de fiado de una persona como imagen PNG para enviar por
// WhatsApp. Se dibuja todo a mano sobre un <canvas> (sin dependencias) con el
// detalle de lo que debe: cargos, pagos a cuenta y saldo final.
//
// El encabezado y el alias salen del club activo: cada uno manda la suya con su
// nombre y su alias para transferir.

const NEGOCIO = 'CLUB'

const COLORS = {
  brand: '#d11f2a', // rojo de la marca
  ink: '#16181d',
  sub: '#6b7280',
  line: '#e6e8ec',
  pago: '#15803d',
  bg: '#ffffff',
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

// Recorta un texto agregando "…" para que entre en `maxWidth` px.
function truncar(ctx, texto, maxWidth) {
  if (ctx.measureText(texto).width <= maxWidth) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

/**
 * Dibuja la boleta y devuelve el <canvas> listo para exportar.
 *
 * `emisor` es el club que la manda: { nombre, ubicacion, alias }.
 */
export function boletaCanvas(saldo, emisor = {}) {
  const cargos = aplicarPagosFIFO(saldo.cargos, saldo.pagos)
  const movs = cargos.length
  const negocio = (emisor.nombre || '').trim().toUpperCase() || NEGOCIO
  const subtitulo = (emisor.ubicacion || '').trim()
  const alias = (emisor.alias || '').trim()

  const dpr = 2
  const W = 560
  const pad = 28
  const headerH = 104
  const rowH = 32

  // Alto dinámico según la cantidad de movimientos y si hay alias que mostrar.
  const yMovsStart = headerH + 32 + 34 + 52 + 28
  const H = yMovsStart + movs * rowH + 20 + 70 + 44 + (alias ? 58 : 0)

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
  ctx.fillText(truncar(ctx, negocio, W - pad * 2), pad, 52)
  if (subtitulo) {
    ctx.font = `600 15px ${FONT}`
    ctx.globalAlpha = 0.92
    ctx.fillText(truncar(ctx, subtitulo, W - pad * 2), pad, 78)
    ctx.globalAlpha = 1
  }

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
    const concepto = c.parcial ? `Resto ${c.concepto}` : c.concepto
    filaTexto(formatDateNumeric(c.dateKey), concepto, formatMoney(c.monto), COLORS.ink)
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

  // Dónde transferir. Va en un recuadro para que se lea de un vistazo: es lo que
  // necesita quien recibe la boleta para poder pagar.
  if (alias) {
    y += 22
    const cajaH = 58
    ctx.fillStyle = '#f6f7f9'
    ctx.fillRect(pad, y, W - pad * 2, cajaH)
    ctx.fillStyle = COLORS.sub
    ctx.font = `700 11px ${FONT}`
    ctx.fillText('PARA TRANSFERIR', pad + 14, y + 22)
    ctx.fillStyle = COLORS.ink
    ctx.font = `700 18px ${FONT}`
    ctx.fillText(truncar(ctx, alias, W - pad * 2 - 28), pad + 14, y + 45)
    y += cajaH
  }

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
export function descargarBoleta(saldo, emisor) {
  const canvas = boletaCanvas(saldo, emisor)
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
