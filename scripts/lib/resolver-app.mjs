// Deja que Node importe los módulos de `src/` tal como los escribe la app, con
// imports sin extensión ("./planilla" en vez de "./planilla.js"). Vite los
// resuelve solo; Node exige la extensión.
//
// Sirve para que los scripts de mantenimiento verifiquen los datos con las
// mismas funciones que usa la app, en vez de con una copia que se desactualice.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
      return await nextResolve(`${specifier}.js`, context)
    }
    throw err
  }
}
