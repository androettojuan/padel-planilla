// Configuración por defecto del club. Se usa como semilla cuando todavía no
// existe el documento config/club en Firestore, y también como fallback cuando
// la app corre sin Firebase configurado (modo demo / localStorage).

export const PAGOS = [
  { id: 'contado', label: 'Contado', short: 'CONT', color: '#16a34a' },
  { id: 'mercado', label: 'Mercado Pago', short: 'MERC', color: '#2563eb' },
  { id: 'anotado', label: 'Anotado', short: 'ANOT', color: '#f59e0b' },
]

export const PAGOS_BY_ID = Object.fromEntries(PAGOS.map((p) => [p.id, p]))

export const DEFAULT_CONFIG = {
  club: {
    nombre: 'Carest Padel',
    ubicacion: 'General Levalle · Cba.',
  },
  canchas: [
    { id: 'c1', nombre: 'Cancha 1' },
    { id: 'c2', nombre: 'Cancha 2' },
  ],
  horarios: [
    { id: 'h1', label: '14:00 a 15:30' },
    { id: 'h2', label: '15:30 a 17:00' },
    { id: 'h3', label: '17:00 a 18:30' },
    { id: 'h4', label: '18:30 a 20:00' },
    { id: 'h5', label: '20:00 a 21:30' },
    { id: 'h6', label: '21:30 a 23:00' },
    { id: 'h7', label: '22:30 a 24:00' },
  ],
  productos: [
    { id: 'p1', nombre: 'Cerveza', precio: 6000 },
    { id: 'p2', nombre: 'Power grande', precio: 5000 },
    { id: 'p3', nombre: 'Power chico', precio: 3000 },
    { id: 'p4', nombre: 'Agua', precio: 2000 },
    { id: 'p5', nombre: 'Gatorade', precio: 4000 },
    { id: 'p6', nombre: 'Alquiler paletas', precio: 3000 },
    { id: 'p7', nombre: 'Tubo de pelotas', precio: 12000 },
  ],
}

export function emptyPlanilla() {
  // turnos: { [`${canchaId}__${horarioId}`]: [{ id, jugador, monto, pago }] }
  // consumos: [{ id, jugador, productoId, nombre, cantidad, precio, pago }]
  return { turnos: {}, consumos: [] }
}

export const turnoKey = (canchaId, horarioId) => `${canchaId}__${horarioId}`
