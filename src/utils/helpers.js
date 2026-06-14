export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Clave para comparar/deduplicar nombres: ignora mayúsculas/minúsculas, acentos,
// comas y espacios de más. "Pérez, Juan" y "perez juan" dan la misma clave.
export function normalizeNombre(nombre) {
  return (nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca diacríticos (acentos, diéresis…)
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatMoney(value) {
  const n = Number(value) || 0
  return money.format(n)
}

// Devuelve la fecha (Date) como 'YYYY-MM-DD' en horario local, sin desfasaje UTC.
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey() {
  return toDateKey(new Date())
}

export function formatLongDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Normaliza una hora ingresada libremente a "HH:MM".
// "1430" -> "14:30", "9" -> "09:00", "9:5" -> "09:05". Permite 24:00.
export function normalizeTime(value) {
  if (!value) return ''
  const raw = String(value).trim()
  if (raw === '') return ''
  let h
  let m
  if (raw.includes(':')) {
    const [hh, mm = ''] = raw.split(':')
    h = hh.replace(/\D/g, '')
    m = mm.replace(/\D/g, '')
  } else {
    const digits = raw.replace(/\D/g, '')
    if (digits.length <= 2) {
      h = digits
      m = ''
    } else {
      h = digits.slice(0, digits.length - 2)
      m = digits.slice(-2)
    }
  }
  if (h === '') return ''
  let hi = Math.min(24, parseInt(h, 10) || 0)
  let mi = Math.min(59, parseInt(m || '0', 10) || 0)
  if (hi === 24) mi = 0
  return `${String(hi).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

// "01/06/26" — fecha numérica corta (incluye año, para deudas de meses viejos).
export function formatDateNumeric(dateKey) {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

// "sáb 13" — etiqueta corta para filas por día.
export function formatDayShort(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
}

// "junio 2026" a partir de "YYYY-MM".
export function formatMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

// Desplaza un "YYYY-MM" por delta meses.
export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}
