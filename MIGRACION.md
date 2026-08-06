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

La app **no se publica a mano**: sale sola a GitHub Pages cuando se pushea a
`master`, y el build tarda unos minutos. Las reglas sí van con `firebase deploy`
y son instantáneas. Entre una cosa y la otra hay un rato en que la app publicada
y las reglas no se corresponden; por eso se hace temprano y de un tirón.

```bash
# 1. Backup fresco, con lo que se haya cargado anoche
npm run db:dump -- --out=firestore-dump/backup-$(date +%F)-prod.json

# 2. Migrar (copia; no borra nada de la raíz)
npm run db:migrate -- --dry-run
npm run db:migrate

# 3. Verificar AHORA, antes de que nadie abra la app nueva
npm run db:check

# 4. Publicar la app: al pushear master, GitHub Actions la construye y sube
git checkout master && git merge feat/multi-club && git push

# 5. Apenas termine el build (mirar la pestaña Actions del repo), las reglas
firebase deploy --only firestore:rules
```

El paso 3 va antes del 4 por algo: en cuanto se carga el primer turno con la app
nueva, la base migrada se separa de las colecciones viejas con todo derecho, y
las diferencias que reporte `db:check` dejan de significar algo.

Después: entrar con la cuenta del club y repetir la revisión a ojo del ensayo
(planilla del día, resumen del mes, fiados, y cargar un turno de prueba y
borrarlo). En los teléfonos y la tablet del club, cerrar y volver a abrir la app:
es una PWA y la versión vieja puede quedar cacheada.

## Si algo sale mal

Primero el camino corto: las colecciones viejas siguen intactas, así que se
vuelve a la versión anterior publicando `master` como estaba y sus reglas.

```bash
git revert -m 1 HEAD && git push        # deshace el merge; Pages reconstruye
git checkout <commit-anterior> -- firestore.rules
firebase deploy --only firestore:rules
```

Y si hubiera que reponer datos, el backup se restaura con:

```bash
npm run db:restore -- --in=firestore-dump/backup-AAAA-MM-DD-prod.json --si
```

Pide escribir `RESTAURAR` a mano, guarda antes una copia de cómo está la base en
ese momento (`firestore-dump/antes-de-restaurar-*.json`) y por defecto **solo
escribe lo que hay en el backup, sin borrar nada** que se haya cargado después.
Con `--exacto` además borra lo que no figure en el backup, dejando la base igual
a esa foto.

Está probado: se borraron a propósito 6 cargos de fiado del emulador y la
restauración los repuso.

## Cuando ya esté todo tranquilo

Recién ahí —después de varios días de uso normal, no el mismo día— borrar las
colecciones viejas de la raíz. Mientras no se corra esto, hay dos copias de todo
y volver atrás sigue siendo gratis.

```bash
npm run db:migrate -- --limpiar
```

Es lo único de todo este procedimiento que borra datos. El backup del día de la
migración conviene guardarlo aparte del repo (mail, Drive, un pendrive) antes de
llegar a este paso.
