import { useEffect, useState } from 'react'
import { formatMoney, soloDigitos, uid } from '../utils/helpers'
import { cantidadDe, costoDe, faltaReponer, ordenarProductos } from '../utils/stock'
import BotonBorrar from './BotonBorrar'

// Lista vacía compartida: un `[]` nuevo en cada render sería una identidad
// distinta para el efecto de abajo, que volvería a correr sin parar.
const SIN_PRODUCTOS = []

/**
 * La lista de productos del club y lo que hay de cada uno, todo en un renglón:
 * nombre y precio de venta (lo que se cobra) junto a las unidades, el mínimo, el
 * costo y la plata inmovilizada (lo que se compra). Antes eran dos tablas con
 * los mismos nombres repetidos.
 *
 * Fuera del modo edición se lee nada más: los campos aparecen como texto y no
 * hay dónde escribir sin querer. Con `editable` se habilitan el nombre, el
 * precio, las unidades, el mínimo y el costo, y aparece el botón de quitar.
 * Cargar una compra, en cambio, está siempre a mano: es la operación de todos
 * los días.
 *
 * El costo normalmente lo deja la última compra; se puede corregir a mano, pero
 * la próxima compra (o la corrección de una ya cargada) vuelve a pisarlo.
 *
 * Lo que se toca se guarda al salir del campo, salvo el producto nuevo: se carga
 * en el primer renglón y recién al confirmarlo con ✓ se guarda y se acomoda en
 * su lugar alfabético.
 */
export default function ListaProductos({
  productos = SIN_PRODUCTOS,
  stock = {},
  editable = false,
  onGuardar,
  onAjustar,
  onMinimo,
  onCosto,
  comprandoId = null,
  onComprar,
  renderCompra,
}) {
  const [lista, setLista] = useState(productos)
  const [nuevoId, setNuevoId] = useState(null)

  // Si los productos cambian afuera (otro dispositivo, o al cambiar de club) se
  // toma esa lista, salvo que se esté cargando una fila nueva.
  useEffect(() => {
    if (!nuevoId) setLista(ordenarProductos(productos))
  }, [productos, nuevoId])

  // Se guarda (y se muestra) en orden alfabético. La fila que se está cargando
  // no se persiste hasta confirmarla, pero se conserva arriba de todo aunque
  // mientras tanto se toque el precio de otro producto.
  const guardar = (next, enCurso = nuevoId) => {
    const limpios = ordenarProductos(
      next
        .filter((p) => p.id !== enCurso)
        .map((p) => ({ ...p, nombre: p.nombre.trim(), precio: Number(p.precio) || 0 })),
    )
    onGuardar(limpios)
    const nuevo = enCurso && next.find((p) => p.id === enCurso)
    setLista(nuevo ? [nuevo, ...limpios] : limpios)
  }

  const patch = (id, cambios) =>
    setLista((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))

  // El producto nuevo se carga arriba de todo, donde está el botón que lo abrió,
  // y no se ordena hasta confirmarlo: si se ordenara mientras se escribe, la
  // fila saltaría de lugar con el nombre a medio poner.
  const agregar = () => {
    if (nuevoId) return
    const nuevo = { id: uid(), nombre: '', precio: '' }
    setNuevoId(nuevo.id)
    setLista((prev) => [nuevo, ...prev])
  }

  const confirmarNuevo = () => {
    const nuevo = lista.find((p) => p.id === nuevoId)
    if (!nuevo?.nombre.trim()) return
    setNuevoId(null)
    guardar(lista, null)
  }

  // Descartar el nuevo es solo sacarlo de la lista: nunca llegó a guardarse.
  const descartarNuevo = () => {
    setLista((prev) => prev.filter((p) => p.id !== nuevoId))
    setNuevoId(null)
  }

  const borrar = (id) => guardar(lista.filter((p) => p.id !== id))

  // La fila que se está cargando tiene dos botones (✓ y ×), igual que las filas
  // en edición: mientras esté abierta, la grilla entera usa ese ancho para que
  // las columnas no queden corridas entre sí.
  const anchoEdicion = editable || nuevoId
  const clase = `stock-row ${anchoEdicion ? 'stock-row--editando' : ''}`

  return (
    <section className="cfg-section">
      <div className="cfg-section__head">
        <h3 className="cfg-section__title">Productos</h3>
        <button className="btn btn--add" onClick={agregar}>
          + Producto
        </button>
      </div>
      <p className="cfg-hint">
        "Venta" es a cuánto lo vendés y "compra" a cuánto te sale a vos; "en plata" es lo que te
        costó el stock que todavía tenés. Cuando el stock llega al mínimo, la app te avisa que hay
        que reponer. Un producto entra al control de stock cuando le cargás la primera compra con
        "+"; hasta entonces se vende sin descontar nada.
      </p>

      {lista.length === 0 && (
        <p className="consumos__empty muted">Todavía no hay productos cargados.</p>
      )}

      {lista.length > 0 && (
        <div className={`stock-head ${anchoEdicion ? 'stock-head--editando' : ''}`}>
          <span>Producto</span>
          <span>Venta</span>
          <span>Compra</span>
          <span>Stock</span>
          <span>Stock mín.</span>
          <span>En plata</span>
          <span />
          {anchoEdicion && <span />}
        </div>
      )}

      {lista.map((p) => {
        const esNuevo = p.id === nuevoId
        if (esNuevo)
          return (
            <div className={clase} key={p.id}>
              <input
                className="cfg-input"
                placeholder="Nombre del producto"
                value={p.nombre}
                autoFocus
                onChange={(e) => patch(p.id, { nombre: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && confirmarNuevo()}
              />
              <input
                className="cfg-input cfg-input--price"
                inputMode="numeric"
                placeholder="$"
                value={p.precio}
                onChange={(e) => patch(p.id, { precio: soloDigitos(e.target.value) })}
                onKeyDown={(e) => e.key === 'Enter' && confirmarNuevo()}
              />
              {/* El resto de la fila queda en blanco: recién con la primera
                  compra el producto entra al control de stock. */}
              <span className="stock-row__hueco" />
              <button
                className="cfg-row__ok"
                onClick={confirmarNuevo}
                disabled={!p.nombre.trim()}
                title="Agregar el producto"
                aria-label="Agregar el producto"
              >
                ✓
              </button>
              <BotonBorrar
                onConfirm={descartarNuevo}
                confirmar={false}
                label="Descartar"
                title="Descartar"
              />
            </div>
          )

        const queda = cantidadDe(stock, p.id)
        const costo = costoDe(stock, p.id)
        const controlado = queda !== null
        return (
          <div key={p.id}>
            <div className={`${clase} ${faltaReponer(stock, p.id) ? 'stock-row--bajo' : ''}`}>
              {editable ? (
                <>
                  <input
                    className="cfg-input"
                    placeholder="Nombre del producto"
                    value={p.nombre}
                    onChange={(e) => patch(p.id, { nombre: e.target.value })}
                    onBlur={() => guardar(lista)}
                  />
                  <input
                    className="cfg-input cfg-input--price"
                    inputMode="numeric"
                    placeholder="$"
                    value={p.precio}
                    onChange={(e) => patch(p.id, { precio: soloDigitos(e.target.value) })}
                    onBlur={() => guardar(lista)}
                  />
                </>
              ) : (
                <>
                  <span className="stock-row__nombre">{p.nombre}</span>
                  <span className="stock-row__num">{formatMoney(p.precio)}</span>
                </>
              )}

              {/* Lo que sale y lo que entra, una al lado de la otra: así se ve
                  de un vistazo cuánto deja cada producto. */}
              {controlado && editable ? (
                <CampoNumero
                  valor={costo}
                  editable
                  onGuardar={(v) => onCosto(p.id, v)}
                  label={`Precio de compra de ${p.nombre}`}
                />
              ) : (
                <span className="stock-row__num">{controlado ? formatMoney(costo) : '—'}</span>
              )}

              {controlado ? (
                <>
                  <CampoNumero
                    valor={queda}
                    editable={editable}
                    onGuardar={(v) => onAjustar(p.id, v)}
                    label={`Stock de ${p.nombre}`}
                  />
                  <CampoNumero
                    valor={stock[p.id]?.minimo || 0}
                    editable={editable}
                    onGuardar={(v) => onMinimo(p.id, v)}
                    label={`Stock mínimo de ${p.nombre}`}
                  />
                </>
              ) : (
                <span className="muted stock-row__sin">sin control</span>
              )}
              <span className="stock-row__num">
                {controlado ? formatMoney(queda * costo) : '—'}
              </span>
              <button
                className="stock-row__compra"
                onClick={() => onComprar(p.id)}
                title={comprandoId === p.id ? 'Cancelar' : `Cargar compra de ${p.nombre}`}
                aria-label={`Cargar compra de ${p.nombre}`}
              >
                {comprandoId === p.id ? '×' : '+'}
              </button>
              {editable && <BotonBorrar onConfirm={() => borrar(p.id)} title="Quitar producto" />}
            </div>

            {comprandoId === p.id && renderCompra?.(p, costo)}
          </div>
        )
      })}
    </section>
  )
}

/**
 * Campo de una cifra que se guarda al salir (o con Enter), no en cada tecla:
 * escribir "24" de a una tecla mandaría también el 2 solo, con su escritura a la
 * base y su vuelta por la suscripción. Bloqueado muestra el número como texto.
 */
function CampoNumero({ valor, onGuardar, label, editable = true }) {
  const [texto, setTexto] = useState(String(valor))
  const [editando, setEditando] = useState(false)

  if (!editable) return <span className="stock-row__num">{valor}</span>

  const guardar = () => {
    setEditando(false)
    // Un campo vacío es alguien que borró para escribir otra cosa y se fue, no
    // un "cero unidades": se descarta y vuelve a mostrarse lo que había.
    if (texto === '' || texto === String(valor)) return
    onGuardar(texto)
  }

  return (
    <input
      className="cfg-input cfg-input--price"
      inputMode="numeric"
      aria-label={label}
      value={editando ? texto : String(valor)}
      onFocus={() => {
        setTexto(String(valor))
        setEditando(true)
      }}
      onChange={(e) => setTexto(soloDigitos(e.target.value))}
      onBlur={guardar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
