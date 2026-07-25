# Planilla de Turnos · Padel

App para anotar los turnos de las canchas de padel y los consumos que va sacando
cada jugador, reemplazando el Excel que se usaba en el club.

Construida con **Vite + React + Firebase** (Firestore + Auth con Google).
Una sola instalación atiende a **varios clubes**: cada uno ve únicamente sus
propios datos.

## Qué hace

- **Grilla de turnos** por cancha y franja horaria. En cada turno se anota el
  jugador, el monto y el tipo de pago (Contado / Mercado Pago / Anotado).
- **Panel de consumos** con selector de productos del club (cerveza, agua, etc.),
  cantidad y tipo de pago. En clubes de 3 canchas o más, Cuentas y Consumos
  dejan la columna del costado y se abren desde la solapa del borde derecho,
  para que la planilla use todo el ancho de la pantalla.
- **Totales del día** discriminados por tipo de pago, en tiempo real.
- **Navegación por fecha**: cada día tiene su propia planilla.
- **Saldos / fiados** y **resumen mensual** por club.
- **Multi-club**: quien trabaja en más de un club lo elige desde el header.

## Quién entra y a qué

- **Usuario de un club**: su email figura en `clubs/{clubId}/miembros`. Puede
  usar y configurar la planilla de ese club, y nada más.
- **Super admin**: su email figura en `superAdmins`. Crea clubes y decide qué
  usuarios entran a cada uno, desde el botón ★ del header. Para *usar* la
  planilla de un club también tiene que agregarse como usuario de ese club.

El alta de super admins **no se hace desde la app**: se carga a mano un
documento en `superAdmins/{email}` desde la consola de Firebase. Es el único
privilegio que no puede otorgarse desde adentro.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar con los datos del proyecto Firebase
npm run dev
```

> Sin `.env` la app corre en **modo demo** con un club local y guarda todo en
> `localStorage` del navegador.

### Configurar Firebase

1. Crear un proyecto en <https://console.firebase.google.com>.
2. Agregar una app **Web** y copiar las credenciales al `.env`.
3. En **Authentication → Sign-in method**, habilitar **Google**.
4. En **Firestore Database**, crear la base y publicar las reglas:
   `firebase deploy --only firestore:rules,firestore:indexes`.
5. Crear a mano el documento `superAdmins/{tu-email}` para poder administrar.

## Estructura de datos en Firestore

```
superAdmins/{email}                     quién puede administrar clubes
clubs/{clubId}                          { nombre, ubicacion, activo, creado }
  ├─ miembros/{email}                   quién entra a este club
  ├─ config/club                        canchas, horarios y productos
  ├─ planillas/{YYYY-MM-DD}             { turnos, consumos, mostrador }
  ├─ jugadores/{id}                     directorio del club
  └─ fiadoPagos|fiadoCargos|fiadoCortes|fiadoArchivados/{id}
```

El aislamiento entre clubes lo garantizan las reglas (`firestore.rules`), no la
UI: un usuario que no es miembro de un club no puede leer ni escribir nada de
ese club aunque conozca su id.

## Entorno de pruebas local

El emulador de Firebase permite trabajar sobre una **copia de los datos reales**
sin tocar producción.

```bash
npm run emulators                 # levanta Firestore + Auth + UI (puerto 4000)
npm run db:dump                   # copia producción → firestore-dump/latest.json
npm run db:seed -- --reset --super=tu-email@gmail.com   # carga esa copia en el emulador
npm run dev:emulator              # la app apunta al emulador (aviso visible en pantalla)
```

`db:dump` necesita credenciales de administrador: o bien
`gcloud auth application-default login`, o bien una clave de cuenta de servicio
(Consola Firebase → Configuración → Cuentas de servicio → Generar clave privada)
guardada como `service-account.json` en la raíz. El dump y la clave están
ignorados por git.

En el emulador el login con Google no pide contraseña: abre un popup donde se
elige o inventa una cuenta de prueba.

### Probar las reglas

```bash
npm run emulators      # en otra terminal
npm run test:rules
```

Verifica que un club no pueda ver los datos de otro, que nadie se agregue solo a
un club y que solo el super admin dé de alta usuarios.

## Migración a multi-club

La base vieja tenía las colecciones en la raíz (`config`, `planillas`,
`jugadores`, `fiado*`, `allowlist`). El script las copia bajo `clubs/{clubId}`
sin borrar nada del origen:

```bash
npm run db:migrate -- --emulator --dry-run    # simulación sobre la copia local
npm run db:migrate -- --emulator              # migrar en el emulador y probar la app
npm run db:migrate                            # migrar PRODUCCIÓN
npm run db:migrate -- --limpiar               # recién después de verificar: borra lo viejo
```

Opciones: `--club=carest`, `--nombre="Carest Padel"`, `--ubicacion="…"`.
Los emails de `allowlist` se convierten en los miembros del club migrado.

## Logo

Colocá el logo del club en `public/logo.svg` y aparece en el header (y como
favicon). Si no existe, simplemente no se muestra.

## Build

```bash
npm run build      # genera dist/
npm run preview    # sirve el build localmente
```
