import { useState } from 'react'
import { nombresUnicos } from '../utils/consumos'
import NombreInput from './NombreInput'

// ---------------------------------------------------------------------------
// Repartir un consumo entre varios: entre cuántos va y, si hace falta, quiénes.
// El nombre sirve para el que tiene cuenta en el club, pero al que paga en
// efectivo o con Mercado Pago no hay por qué pedírselo.
//
// Lo usan los dos lugares donde se reparte —al cargar el consumo y al dividir uno
// ya cargado—, que muestran las mismas piezas en distinto orden. Por eso el
// estado va en un hook y las piezas son componentes sueltos, en vez de un único
// formulario que después haya que parametrizar.
// ---------------------------------------------------------------------------

/**
 * `inicial` son los jugadores de un consumo ya dividido, en orden de parte. Puede
 * traer huecos —las partes que se cargaron sin nombre—: esos no arman chip, pero
 * sí cuentan para saber en cuántas partes venía dividido.
 */
export function useReparto(inicial = []) {
  const [nombres, setNombres] = useState(() => nombresUnicos(inicial))
  const [texto, setTexto] = useState('')
  const [partes, setPartes] = useState(Math.max(1, inicial.length))

  // Los nombres del "+" más lo que haya quedado escrito en el input.
  const lista = nombresUnicos([...nombres, texto])
  // Nunca menos partes que nombres cargados: cada uno tiene que tener la suya.
  const total = Math.max(partes, lista.length)

  return {
    lista,
    total,
    nombres,
    texto,
    setTexto,
    sumar: () => {
      const nombre = texto.trim()
      if (!nombre) return
      setNombres((prev) => nombresUnicos([...prev, nombre]))
      setTexto('')
    },
    quitar: (nombre) => setNombres((prev) => prev.filter((n) => n !== nombre)),
    menos: () => setPartes(Math.max(1, total - 1)),
    mas: () => setPartes(total + 1),
    // Bajar por debajo de la cantidad de nombres dejaría a alguien sin parte.
    puedeBajar: total > 1 && total > lista.length,
    limpiar: () => {
      setNombres([])
      setTexto('')
      setPartes(1)
    },
  }
}

// Chips con los nombres ya sumados, cada uno con su "×".
export function RepartoChips({ nombres, onQuitar }) {
  if (!nombres.length) return null
  return (
    <ul className="reparto">
      {nombres.map((n) => (
        <li className="reparto__chip" key={n}>
          {n}
          <button className="reparto__del" onClick={() => onQuitar(n)} aria-label={`Quitar ${n}`}>
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

// Campo de nombre con el "+" que lo suma al reparto. `onEnter` decide qué hace
// la tecla Enter: sumar otro nombre, o confirmar de una.
export function RepartoInput({
  reparto,
  sugerencias,
  onCommitNombre,
  placeholder = 'Jugador',
  onEnter,
}) {
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
        disabled={!reparto.texto.trim()}
        title="Sumar otro jugador para dividir el consumo"
      >
        +
      </button>
    </div>
  )
}

// Entre cuántos se divide: −, el número, +.
export function RepartoPartes({ reparto, label }) {
  return (
    <div className="partes">
      <span className="partes__label">{label}</span>
      <button
        className="qty-btn"
        onClick={reparto.menos}
        disabled={!reparto.puedeBajar}
        aria-label="Entre menos"
      >
        −
      </button>
      <span className="qty-value">{reparto.total}</span>
      <button className="qty-btn" onClick={reparto.mas} aria-label="Entre más">
        +
      </button>
    </div>
  )
}
