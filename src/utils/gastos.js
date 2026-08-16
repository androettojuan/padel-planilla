// Lo que se gastó en el mes. Vive acá para que la pantalla de gastos y el
// resumen mensual cuenten lo mismo.
export const totalGastos = (gastos = []) => gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0)

// Del más nuevo al más viejo: lo último que se cargó es lo que se está mirando.
export const ordenarGastos = (gastos = []) =>
  [...gastos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.ts || 0) - (a.ts || 0))
