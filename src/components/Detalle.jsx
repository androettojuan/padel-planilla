import { useState } from 'react'

/**
 * Bloque de detalle que arranca plegado: se ve el título y su total, y el cuerpo
 * se despliega al tocarlo. Sirve para que una pantalla muestre primero los
 * números grandes y deje las listas largas a un toque de distancia.
 */
export default function Detalle({ titulo, total, children, abiertoInicial = false }) {
  const [abierto, setAbierto] = useState(abiertoInicial)

  return (
    <section className="detalle">
      <button
        className="detalle__head"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className="detalle__titulo">
          <span className="detalle__flecha" aria-hidden="true">
            {abierto ? '▾' : '▸'}
          </span>
          {titulo}
        </span>
        {total != null && <span className="detalle__total">{total}</span>}
      </button>
      {abierto && <div className="detalle__body">{children}</div>}
    </section>
  )
}
