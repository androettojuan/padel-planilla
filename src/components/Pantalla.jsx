/**
 * Marco de una sección: título, acciones a la derecha y el contenido. Reemplaza
 * al chrome de los modales (overlay, ✕ y pie con "Cerrar"), que ahora no hace
 * falta porque cada sección es una página con su propia URL.
 */
export default function Pantalla({ titulo, descripcion, acciones, children, footer }) {
  return (
    <section className="pantalla">
      <div className="pantalla__head">
        <div>
          <h2 className="pantalla__titulo">{titulo}</h2>
          {descripcion && <p className="pantalla__desc">{descripcion}</p>}
        </div>
        {acciones && <div className="pantalla__acciones">{acciones}</div>}
      </div>
      <div className="pantalla__body">{children}</div>
      {footer && <div className="pantalla__footer">{footer}</div>}
    </section>
  )
}
