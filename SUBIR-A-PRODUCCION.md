# Pasos para subir a producción

Checklist para seguir de arriba abajo. El porqué de cada cosa está en
[MIGRACION.md](MIGRACION.md); acá están los comandos y qué tiene que pasar.

Hacelo **a la mañana, con el club sin usar la app**. De punta a punta son unos
20 minutos, la mayoría esperando el build.

Todos los comandos se corren desde `/home/juan/repos/padel-planilla`.

---

## 0 · Antes de arrancar

- [ ] Estar en la rama del trabajo nuevo:

```bash
git checkout feat/multi-club && git status --short
```

Tiene que salir limpio (sin archivos modificados).

- [ ] El índice de `miembros` tiene que estar creado **y en estado Enabled**. Si
      ya lo hiciste ayer, saltealo. Si no:

```bash
firebase deploy --only firestore:indexes
```

Mirá en la consola de Firebase → Firestore → Índices que figure **Enabled**.
Tarda unos minutos. **Sin esto nadie puede iniciar sesión en la app nueva.**

---

## 1 · Backup

```bash
npm run db:dump -- --out=firestore-dump/backup-$(date +%F)-prod.json
```

Esperado: `✔ NNN documentos → …/backup-2026-XX-XX-prod.json`

En el ensayo fueron 338 documentos; mañana serán algunos más, por lo que se
cargue hoy.

- [ ] **Copiá ese archivo a otro lado** (mail, Drive, pendrive). Es el único
      respaldo que vive fuera de la base.

> Si falla por credenciales, volvé a correr `gcloud auth application-default login`.

---

## 2 · Migrar los datos

Primero la simulación, que no escribe nada:

```bash
npm run db:migrate -- --dry-run
```

- [ ] Revisá que la lista tenga sentido: club `carest`, los 4 emails de la
      allowlist, y las colecciones con sus cantidades.

Y ahora sí:

```bash
npm run db:migrate
```

Esperado: `✔ migración terminada`

Esto **copia** a `clubs/carest/…` y **no borra** nada de las colecciones viejas.

---

## 3 · Verificar — antes de abrir la app

```bash
npm run db:check
```

- [ ] Tiene que terminar con:
      `✔ Todo verificado: la migración es fiel y los números no cambian.`

**Si dice que hay problemas, pará acá.** No publiques nada: los datos viejos
siguen intactos y la app en el aire sigue siendo la de siempre, así que no pasó
nada. Mandame la salida.

Este paso va **antes** de abrir la app nueva: en cuanto se cargue el primer
turno, la base migrada empieza a separarse de las viejas con todo derecho y el
chequeo va a marcar diferencias que no son errores.

El propio comando imprime los totales de los últimos meses y la deuda de fiados.
De referencia, en el ensayo de ayer daban:

| | |
| --- | --- |
| Julio 2026 | facturado 2.717.500 · contado 1.305.500 · mercado 1.016.000 · anotado 319.000 · sin cobrar 77.000 |
| Junio 2026 | facturado 2.604.000 |
| Fiados | 301.500 entre 20 cuentas |

Mañana julio y los fiados van a ser **algo más altos** por lo que se cargue hoy:
eso es normal. Lo que importa no es que coincidan con esta tabla, sino que
`db:check` diga que el antes y el después de la migración son iguales.

---

## 4 · Publicar la app

```bash
git checkout master
git merge --no-ff feat/multi-club
git push
```

El `--no-ff` es a propósito: deja un commit de merge, y con eso deshacer todo
mañana es un solo comando. Sin él, master avanzaría sin dejar ese punto y volver
atrás sería mucho más incómodo.

Esto dispara el build en GitHub Actions, que publica en GitHub Pages.

- [ ] Abrí la pestaña **Actions** del repo y esperá a que el workflow termine en
      verde. Son unos minutos.

---

## 5 · Publicar las reglas

Apenas terminó el build del paso 4:

```bash
firebase deploy --only firestore:rules
```

Es instantáneo. A partir de acá la app vieja deja de funcionar: las reglas
nuevas no permiten las colecciones viejas.

---

## 6 · Revisar que todo ande

Entrá a la app con la cuenta del club y mirá:

- [ ] Inicia sesión y entra al club (si acá falla, es el índice del paso 0).
- [ ] La planilla del día muestra los turnos y el total arriba.
- [ ] **Finanzas → Resumen del mes**: los totales son los que venías viendo.
- [ ] **Finanzas → Fiados**: está la lista de deudores con sus montos.
- [ ] Configuración: canchas y horarios (incluidos sábado y domingo, que el club
      tiene distintos).
- [ ] Cargá un turno de prueba, recargá la página para ver que quedó guardado, y
      borralo.

Y en los aparatos del club:

- [ ] En la tablet y los teléfonos, **cerrar la app y volver a abrirla**. Es una
      PWA y puede quedar la versión vieja guardada.

---

## Si algo sale mal

Volver atrás. Los datos viejos siguen intactos, así que es solo volver a la
versión anterior:

```bash
git checkout master
git revert -m 1 HEAD && git push      # deshace el merge; Pages reconstruye sola
git checkout a72a8d8 -- firestore.rules   # las reglas del modelo viejo
firebase deploy --only firestore:rules
```

(`a72a8d8` es el último commit de master antes de todo esto: "fix: archivar
cuentas sin borrar los pagos".)

Si además hubiera que reponer datos:

```bash
npm run db:restore -- --in=firestore-dump/backup-AAAA-MM-DD-prod.json --si
```

Pide escribir `RESTAURAR` a mano, guarda antes una copia de cómo está la base en
ese momento, y por defecto **no borra** nada que se haya cargado después del
backup.

---

## Lo que NO hay que hacer todavía

**No corras `npm run db:migrate -- --limpiar`.** Es lo único que borra las
colecciones viejas, y mientras no lo hagas hay dos copias completas de todo y
volver atrás es gratis. Dejalo para dentro de unos días, cuando el club haya
usado la versión nueva sin problemas.
