import { useState } from 'react'
import { nombresUnicos } from '../utils/consumos'
import NombreInput from './NombreInput'

// ---------------------------------------------------------------------------
// Repartir un consumo entre varios: entre cuántos va y, si hace falta, quiénes.
// El nombre sirve para el que tiene cuenta en el club, pero al que paga en
// efectivo o con Mercado Pago no hay por qué pedírselo.
//
// Todo se maneja con un solo botón "+": con un nombre escrito lo suma al
// reparto, y vacío suma una parte más sin nombre. Así no hace falta un contador
// aparte, y el reparto se ve entero en los chips —los con nombre y los sin—.
//
// Lo usan los dos lugares donde se reparte, al cargar el consumo y al dividir
// uno ya cargado; por eso el estado va en un hook y las piezas son componentes
// sueltos, que cada lado ordena como le sirve.
// ---------------------------------------------------------------------------

/**
 * `inicial` son los jugadores de un consumo ya dividido, en orden de parte. Puede
 * traer huecos —las partes que se cargaron sin nombre—: esos no arman chip con
 * nombre, pero sí cuentan para saber en cuántas partes venía dividido.
 */
export function useReparto(inicial = []) {
  const [nombres, setNombres] = useState(() => nombresUnicos(inicial))
  const [texto, setTexto] = useState('')
  const [partes, setPartes] = useState(Math.max(1, inicial.length))

  // Los nombres del "+" más lo que haya quedado escrito en el input.
  const lista = nombresUnicos([...nombres, texto])
  // Nunca menos partes que nombres cargados: cada uno tiene que tener la suya.
  const total = Math.max(partes, lista.length)
  // Partes que todavía no tienen nombre. Lo que se está escribiendo cuenta como
  // una parte con nombre, así no aparece un hueco de más mientras se tipea. Sin
  // dividir (una sola parte) no hay reparto que mostrar.
  const huecos = total > 1 ? Math.max(0, total - lista.length) : 0

  return {
    lista,
    total,
    huecos,
    nombres,
    texto,
    setTexto,
    // El botón de siempre: suma el nombre escrito o, si no hay ninguno, una
    // parte más sin nombre.
    sumar: () => {
      const nombre = texto.trim()
      if (nombre) {
        setNombres((prev) => nombresUnicos([...prev, nombre]))
        setTexto('')
      } else {
        setPartes(total + 1)
      }
    },
    // Sacar un chip achica la división en uno, tenga nombre o no.
    quitar: (nombre) => {
      setNombres((prev) => prev.filter((n) => n !== nombre))
      setPartes((p) => Math.max(1, Math.min(p, total - 1)))
    },
    quitarParte: () => setPartes(Math.max(1, total - 1)),
    limpiar: () => {
      setNombres([])
      setTexto('')
      setPartes(1)
    },
  }
}

// El reparto armado hasta ahora: un chip por parte, con nombre o sin él.
export function RepartoChips({ reparto }) {
  const { nombres, huecos, quitar, quitarParte } = reparto
  if (!nombres.length && !huecos) return null
  return (
    <ul className="reparto">
      {nombres.map((n) => (
        <li className="reparto__chip" key={n}>
          {n}
          <button className="reparto__del" onClick={() => quitar(n)} aria-label={`Quitar ${n}`}>
            ×
          </button>
        </li>
      ))}
      {Array.from({ length: huecos }, (_, i) => (
        <li className="reparto__chip reparto__chip--anon" key={`parte-${i}`}>
          Sin nombre
          <button className="reparto__del" onClick={quitarParte} aria-label="Quitar esta parte">
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

// Campo de nombre con el "+" que suma al reparto. `onEnter` decide qué hace la
// tecla Enter: sumar otro nombre, o confirmar de una.
export function RepartoInput({
  reparto,
  sugerencias,
  onCommitNombre,
  placeholder = 'Jugador',
  onEnter,
}) {
  const conNombre = !!reparto.texto.trim()
  return (
    <div className="consumos__row">
      <NombreInput
        className="consumos__player"
        placeholder={placeholder}
        value={reparto.texto}
        sugerencias={sugerencias}
        onChange={reparto.setTexto}
        onCommit={onCommitNombre}
        onEnter={onEnter || reparto.sumar}
      />
      <button
        className="btn btn--ghost-sm reparto__add"
        onClick={reparto.sumar}
        title={
          conNombre
            ? 'Sumar este jugador al reparto'
            : 'Dividir en una parte más, sin poner nombre'
        }
        aria-label={conNombre ? 'Sumar jugador' : 'Sumar una parte'}
      >
        +
      </button>
    </div>
  )
}
