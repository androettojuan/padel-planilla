import { useEffect, useState } from 'react'
import { uid } from '../utils/helpers'
import BotonBorrar from './BotonBorrar'

/**
 * Productos del club: nombre y precio de venta. Vive en la sección de Stock
 * porque es lo mismo que después se compra y se descuenta.
 *
 * Se guarda al salir de cada campo (igual que el directorio de jugadores), así no
 * hay un botón "Guardar" que compita con el resto de la pantalla, que también
 * guarda al instante.
 */
export default function ProductosSection({ productos = [], onGuardar }) {
  const [lista, setLista] = useState(productos)
  const [nuevoId, setNuevoId] = useState(null)

  // Si los productos cambian afuera (otro dispositivo, o al cambiar de club) se
  // toma esa lista, salvo que se esté editando una fila recién agregada.
  useEffect(() => {
    if (!nuevoId) setLista(productos)
  }, [productos, nuevoId])

  const guardar = (next) => {
    setLista(next)
    onGuardar(next.map((p) => ({ ...p, nombre: p.nombre.trim(), precio: Number(p.precio) || 0 })))
  }

  const patch = (id, cambios) =>
    setLista((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))

  const agregar = () => {
    const nuevo = { id: uid(), nombre: '', precio: 0 }
    setNuevoId(nuevo.id)
    setLista((prev) => [...prev, nuevo])
  }

  const borrar = (id) => {
    setNuevoId(null)
    guardar(lista.filter((p) => p.id !== id))
  }

  return (
    <section className="cfg-section">
      <div className="cfg-section__head">
        <h3 className="cfg-section__title">Productos</h3>
        <button className="btn btn--add" onClick={agregar}>
          + Producto
        </button>
      </div>
      <p className="cfg-hint">
        Lo que se vende en el bar, con su precio de venta. Los cambios se guardan al
        instante.
      </p>
      {lista.length === 0 && (
        <p className="consumos__empty muted">Todavía no hay productos cargados.</p>
      )}
      {lista.map((p) => (
        <div className="cfg-row cfg-row--producto" key={p.id}>
          <input
            className="cfg-input"
            placeholder="Nombre del producto"
            value={p.nombre}
            autoFocus={p.id === nuevoId}
            onChange={(e) => patch(p.id, { nombre: e.target.value })}
            onBlur={() => {
              setNuevoId(null)
              guardar(lista)
            }}
          />
          <input
            className="cfg-input cfg-input--price"
            inputMode="numeric"
            placeholder="$"
            value={p.precio}
            onChange={(e) => patch(p.id, { precio: e.target.value.replace(/[^\d]/g, '') })}
            onBlur={() => guardar(lista)}
          />
          <BotonBorrar onConfirm={() => borrar(p.id)} title="Quitar producto" />
        </div>
      ))}
    </section>
  )
}
