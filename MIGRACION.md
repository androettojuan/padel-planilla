# Pasar Carest Padel a la versión multi-club

Los datos del club están hoy en las colecciones de la raíz (`config`, `planillas`,
`jugadores`, `fiado*`, `allowlist`). La versión nueva los lee bajo
`clubs/carest/…`. Migrar es **copiar** de un lado al otro: el script no borra
nada del origen, así que mientras no se limpie hay dos copias y se puede volver
atrás.

Lo que **no** hace falta migrar: el stock (arranca vacío y un producto sin
compras se vende sin descontar), el modo de planilla y el alias del club (tienen
valor por defecto), y los consumos viejos (no tienen costo cargado, así que el
mes no muestra ganancia hasta que haya ventas nuevas). Las cuentas de mostrador
del modelo viejo se siguen leyendo y sumando igual.

## Lo importante antes de empezar

**Las reglas nuevas no permiten las colecciones viejas.** En cuanto se publican,
la app vieja deja de poder leer y escribir. Por eso reglas y app se publican
juntas, y la migración se corre inmediatamente antes, con el club sin usar la
app (a la mañana).

**La migración se corre una sola vez.** Es idempotente en el sentido de que no
duplica documentos, pero si alguien ya cargó algo en el modelo nuevo y después
se vuelve a correr, la copia vieja le pisa lo nuevo.

## Antes (se puede hacer cualquier día, no molesta a nadie)

Crear el índice que la app nueva necesita para el login ("¿a qué clubes
pertenezco?"). Tarda unos minutos en construirse y hay que esperar a que figure
como **Enabled** en la consola. Publicar la app sin esto deja a todos afuera.

```bash
firebase deploy --only firestore:indexes
```

## Ensayo en el emulador

```bash
gcloud auth application-default login    # una sola vez, da acceso de lectura
npm run db:dump                          # copia producción → firestore-dump/latest.json
cp firestore-dump/latest.json firestore-dump/backup-$(date +%F).json

npm run emulators                        # en otra terminal
npm run db:seed -- --reset --super=tu-email@gmail.com
npm run db:migrate -- --emulator --dry-run   # qué haría, sin escribir
npm run db:migrate -- --emulator             # migrar la copia local
npm run db:check -- --emulator               # verificar
npm run dev:emulator                         # revisar la app a ojo
```

`db:check` compara documento por documento el origen contra lo migrado y,
además, calcula el resumen de cada mes y la deuda de fiados **con el código de
la app** de los dos lados: si algún número cambia, lo dice y termina con error.

En la app conviene mirar: que estén las canchas y los horarios, un par de días
con turnos cargados, el resumen del último mes (que los totales sean los que el
club ve hoy) y los fiados (que cada uno deba lo mismo).

### Resultado del ensayo del 30/07/2026

Se migró una copia de producción completa (338 documentos) y quedó todo bien.
Sirve de referencia para comparar mañana: si estos números no cambian, la
migración salió igual.

| | |
| --- | --- |
| Documentos migrados | 334 (232 jugadores, 58 planillas, 19 cortes, 12 cargos, 12 pagos, 1 config) |
| Miembros del club | 4, desde la allowlist |
| Julio 2026 | facturado 2.717.500 · contado 1.305.500 · mercado 1.016.000 · anotado 319.000 · sin cobrar 77.000 |
| Junio 2026 | facturado 2.604.000 · contado 1.355.400 · mercado 992.100 · anotado 256.500 |
| Fiados | 301.500 entre 20 cuentas |

Además se verificó en la app, con esos datos: la planilla del día, el resumen del
mes, los fiados, la configuración de horarios (incluidos los de sábado y domingo,
que el club tiene distintos), la boleta de un deudor real, y que se pueda
**escribir** un turno con las reglas nuevas. Las 20 pruebas de reglas pasan.

Sobre los 834 turnos cargados: todos son del modo clásico (por jugadores), así
que se siguen viendo igual. Los 163 consumos no tienen costo —son anteriores al
stock—, así que el resumen del mes no va a mostrar ganancia hasta que se carguen
compras y se vendan productos nuevos. Las 4 planillas con cuentas de mostrador
del modelo viejo se leen y suman igual que antes.

## Producción (a la mañana, con el club sin usar la app)

```bash
# 1. Backup fresco, con lo que se haya cargado anoche
npm run db:dump -- --out=firestore-dump/backup-$(date +%F)-prod.json

# 2. Migrar (copia; no borra nada)
npm run db:migrate -- --dry-run
npm run db:migrate

# 3. Verificar antes de publicar
npm run db:check

# 4. Publicar reglas y app juntas
npm run build
firebase deploy --only firestore:rules,hosting
```

Después: entrar a la app con la cuenta del club y repetir la revisión a ojo del
ensayo. Y avisarle al club que si tenía la página abierta, la recargue.

## Si algo sale mal

El backup del paso 1 se vuelve a cargar con `db:seed` apuntando a producción, pero
**antes de eso** está el camino corto: las colecciones viejas siguen intactas, así
que alcanza con volver a la versión anterior de la app y a sus reglas.

```bash
git checkout master -- firestore.rules   # reglas del modelo viejo
git stash                                # guardar el código nuevo
git checkout master
npm run build
firebase deploy --only firestore:rules,hosting
```

## Cuando ya esté todo tranquilo

Recién ahí, borrar las colecciones viejas de la raíz:

```bash
npm run db:migrate -- --limpiar
```
