# Planilla de Turnos · Padel

App para anotar los turnos de las canchas de padel y los consumos que va sacando
cada jugador, reemplazando el Excel que se usaba en el club.

Construida con **Vite + React + Firebase** (Firestore + Auth anónimo).

## Qué hace (v1)

- **Grilla de turnos** por cancha y franja horaria. En cada turno se anota el
  jugador, el monto y el tipo de pago (Contado / Mercado Pago / Anotado).
- **Panel de consumos** con selector de productos del club (cerveza, agua, etc.),
  cantidad y tipo de pago.
- **Totales del día** discriminados por tipo de pago, en tiempo real.
- **Navegación por fecha**: cada día tiene su propia planilla.
- **Uso interno sin login**: la app inicia una sesión anónima automáticamente, así
  Firestore queda protegido por reglas sin mostrar pantalla de login.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar con los datos del proyecto Firebase
npm run dev
```

> Sin `.env` la app igual corre en **modo demo** y guarda los datos en
> `localStorage` del navegador.

### Configurar Firebase

1. Crear un proyecto en <https://console.firebase.google.com>.
2. Agregar una app **Web** y copiar las credenciales al `.env`.
3. En **Authentication → Sign-in method**, habilitar **Anónimo**.
4. En **Firestore Database**, crear la base y publicar las reglas de
   `firestore.rules` (o `firebase deploy --only firestore:rules`).

## Estructura de datos en Firestore

- `config/club` → canchas, horarios y productos (se siembra solo la primera vez
  con los valores de `src/data/defaults.js`).
- `planillas/{YYYY-MM-DD}` → `{ turnos, consumos }` de ese día.

## Logo

Colocá el logo del club en `public/logo.png` y aparece en el header (y como
favicon). Si no existe, simplemente no se muestra.

## Build

```bash
npm run build      # genera dist/
npm run preview    # sirve el build localmente
```
