import { uid } from './helpers'

// ---------------------------------------------------------------------------
// Dos formas de anotar un turno, según cómo trabaje el club:
//
//   'jugadores' — la de siempre: cuatro líneas por turno, una por jugador, cada
//     una con su nombre y su monto. Sirve donde se le cobra a cada uno.
//   'reserva'   — una sola línea: quién reservó y cuánto sale el turno. Lo que
//     paguen se va anotando encima como pagos sueltos, que pueden ser de
//     distintas personas y con distintos medios, hasta cubrir el precio.
//
// La diferencia vive en el dato, no en la config: un turno de reserva lleva su
// lista `pagos`. Así los cálculos (cuentas del día, resumen, fiados) no
// necesitan saber en qué modo está el club, y una planilla vieja se sigue
// leyendo igual aunque el club cambie de modo.
// ---------------------------------------------------------------------------

export const MODO_JUGADORES = 'jugadores'
export const MODO_RESERVA = 'reserva'

export const modoPlanilla = (config) =>
  config?.modoPlanilla === MODO_RESERVA ? MODO_RESERVA : MODO_JUGADORES

export const esReserva = (config) => modoPlanilla(config) === MODO_RESERVA

// Una línea de turno es "de reserva" si lleva lista de pagos, la haya usado o no.
export const tienePagos = (turno) => Array.isArray(turno?.pagos)

export const pagosDe = (turno) => (tienePagos(turno) ? turno.pagos : [])

export const totalPagado = (turno) =>
  pagosDe(turno).reduce((s, p) => s + (Number(p.monto) || 0), 0)

// Lo que falta cobrar del turno. Nunca negativo: si pagaron de más, el excedente
// se ve en la lista de pagos, no como un saldo al revés.
export const saldoTurno = (turno) =>
  Math.max(0, (Number(turno?.monto) || 0) - totalPagado(turno))

export const turnoSaldado = (turno) =>
  tienePagos(turno) ? (Number(turno?.monto) || 0) > 0 && saldoTurno(turno) === 0 : !!turno?.pagado

/**
 * Convierte un turno en las líneas de facturación con las que trabajan las
 * cuentas del día, el resumen del mes y los fiados.
 *
 * Un turno clásico ya es una línea. Uno de reserva se abre en una línea por pago
 * —cobrada, con su medio y a nombre de quien pagó— más una última línea por lo
 * que todavía falta, a nombre de quien reservó. Así un pago "anotado" de un
 * jugador cae en su fiado sin que nada más tenga que enterarse del modo.
 */
export function lineasDeTurno(turno) {
  if (!tienePagos(turno)) {
    return [
      {
        jugador: turno?.jugador,
        monto: Number(turno?.monto) || 0,
        pagado: !!turno?.pagado,
        pago: turno?.pago,
      },
    ]
  }

  const lineas = pagosDe(turno).map((p) => ({
    jugador: (p.nombre || '').trim() || turno.jugador,
    monto: Number(p.monto) || 0,
    pagado: true,
    pago: p.pago,
  }))
  const resto = saldoTurno(turno)
  if (resto > 0) {
    lineas.push({ jugador: turno.jugador, monto: resto, pagado: false, pago: null })
  }
  return lineas
}

// Turno vacío del modo que corresponda. En reserva arranca con `pagos: []`, que
// es lo que después lo identifica.
export const turnoNuevo = (modo) =>
  modo === MODO_RESERVA
    ? { id: uid(), jugador: '', monto: '', pagos: [] }
    : { id: uid(), jugador: '', monto: '', pagado: false }

export const pagoNuevo = ({ nombre = '', monto = 0, pago = 'contado' } = {}) => ({
  id: uid(),
  nombre: (nombre || '').trim(),
  monto: Math.max(0, Math.round(Number(monto) || 0)),
  pago,
})

export const agregarPago = (turno, datos) => ({
  ...turno,
  pagos: [...pagosDe(turno), pagoNuevo(datos)],
})

export const quitarPago = (turno, pagoId) => ({
  ...turno,
  pagos: pagosDe(turno).filter((p) => p.id !== pagoId),
})
