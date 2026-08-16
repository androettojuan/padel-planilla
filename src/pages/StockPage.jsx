import { useEffect, useMemo, useState } from 'react'
import { formatMoney, formatDateNumeric, soloDigitos, todayKey } from '../utils/helpers'
import { ordenarProductos, productosAReponer, valorStock } from '../utils/stock'
import { loadCompras } from '../firebase/stock'
import { useClubId } from '../hooks/useClub'
import BotonBorrar from '../components/BotonBorrar'
import Pantalla from '../components/Pantalla'
import ListaProductos from '../components/ListaProductos'

// Lista vacía compartida, para que el club sin productos no arme un array nuevo
// en cada render y con eso invalide los cálculos memorizados.
const SIN_PRODUCTOS = []

/**
 * Pantalla de stock: una sola lista con los productos del club (nombre y precio
 * de venta), cuánto queda de cada uno, a qué costo entró y cuánta plata hay
 * inmovilizada. Desde acá se cargan las compras (que suman al stock y dejan el
 * costo nuevo), se corrige a mano lo que hay y se fija el mínimo con el que el
 * producto queda marcado para reponer.
 *
 * Todo se mira bloqueado y se desbloquea con "✎ Editar": es una pantalla de
 * consulta diaria, y un manotazo sobre un campo no debería cambiar el stock.
 */
export default function StockPage({
  config,
  stock,
  onGuardarProductos,
  onComprar,
  onEditarCompra,
  onDeshacerCompra,
  onAjustar,
  onMinimo,
  onCosto,
}) {
  const clubId = useClubId()
  // Alfabético también acá: lo que se guardó antes de ordenar (o desde otra
  // versión) se ve en el mismo orden que la lista de arriba.
  const productos = useMemo(
    () => ordenarProductos(config.productos || SIN_PRODUCTOS),
    [config.productos],
  )
  const [compras, setCompras] = useState([])
  // Lo cargado se mira, no se toca: los campos recién se habilitan al entrar en
  // modo edición, así nadie corrige el stock de un manotazo mientras busca algo.
  const [modoEdicion, setModoEdicion] = useState(false)
  const [comprando, setComprando] = useState(null) // productoId con el form abierto
  const [editando, setEditando] = useState(null) // id de la compra que se corrige
  const [error, setError] = useState(null)

  useEffect(() => {
    loadCompras(clubId)
      .then(setCompras)
      .catch(() => {})
  }, [clubId])

  const { total, aReponer } = useMemo(
    () => ({
      total: valorStock(stock, productos),
      aReponer: productosAReponer(stock, productos),
    }),
    [stock, productos],
  )

  // La lista de compras se actualiza en memoria: la operación ya sabe con qué
  // quedó, así que volver a pedirla por red sería una lectura al pedo.
  const comprar = async (producto, cantidad, costo) => {
    setError(null)
    try {
      const compra = await onComprar({
        productoId: producto.id,
        nombre: producto.nombre,
        cantidad,
        costo,
        fecha: todayKey(),
      })
      setComprando(null)
      if (compra) setCompras((prev) => [compra, ...prev])
    } catch (err) {
      setError(err)
    }
  }

  const editar = async (compra, cantidad, costo) => {
    setError(null)
    try {
      await onEditarCompra(compra, { cantidad, costo })
      setEditando(null)
      setCompras((prev) => prev.map((c) => (c.id === compra.id ? { ...c, cantidad, costo } : c)))
    } catch (err) {
      setError(err)
    }
  }

  const deshacer = async (compra) => {
    setError(null)
    try {
      await onDeshacerCompra(compra)
      setCompras((prev) => prev.filter((c) => c.id !== compra.id))
    } catch (err) {
      setError(err)
    }
  }

  return (
    <Pantalla
      titulo="Stock"
      descripcion="Los productos del club, lo que queda de cada uno y las compras con las que se repuso."
      acciones={
        <button
          className={modoEdicion ? 'btn btn--primary' : 'btn btn--ghost-sm'}
          onClick={() => {
            // Al cerrar la edición se cierra también la compra que se estuviera
            // corrigiendo, para no dejar un formulario abierto en modo lectura.
            if (modoEdicion) setEditando(null)
            setModoEdicion(!modoEdicion)
          }}
        >
          {modoEdicion ? 'Listo' : '✎ Editar'}
        </button>
      }
    >
      {error && <p className="banner banner--error">No se pudo guardar: {error.message}</p>}

      <div className="resumen__total">
        <span className="resumen__total-label">Plata en mercadería</span>
        <span className="resumen__total-value">{formatMoney(total)}</span>
      </div>

      {aReponer.length > 0 && (
        <p className="banner banner--warn">
          Hay que reponer: {aReponer.map((p) => p.nombre).join(', ')}.
        </p>
      )}

      <ListaProductos
        productos={productos}
        stock={stock}
        editable={modoEdicion}
        onGuardar={onGuardarProductos}
        onAjustar={onAjustar}
        onMinimo={onMinimo}
        onCosto={onCosto}
        comprandoId={comprando}
        onComprar={(id) => setComprando(comprando === id ? null : id)}
        renderCompra={(p, costo) => (
          <CompraForm
            titulo={`Compra de ${p.nombre}`}
            costoInicial={costo}
            textoConfirmar="Cargar compra"
            onCancel={() => setComprando(null)}
            onConfirm={(cantidad, costoUnit) => comprar(p, cantidad, costoUnit)}
          />
        )}
      />

      {compras.length > 0 && (
        <section className="cfg-section">
          <div className="cfg-section__head">
            <h3 className="cfg-section__title">Últimas compras</h3>
          </div>
          <p className="cfg-hint">
            Si cargaste algo mal, se corrige o se deshace desde acá con "✎ Editar": el stock se
            ajusta por la diferencia y el costo del producto vuelve a ser el de la última compra que
            quede.
          </p>
          <ul className="stock-compras">
            {compras.map((c) =>
              editando === c.id ? (
                <li key={c.id}>
                  <CompraForm
                    titulo={`Corregir la compra de ${c.nombre}${
                      c.fecha ? ` del ${formatDateNumeric(c.fecha)}` : ''
                    }`}
                    cantidadInicial={c.cantidad}
                    costoInicial={c.costo}
                    textoConfirmar="Guardar"
                    // Lo que importa al corregir es qué le pasa al stock de hoy:
                    // cambiar 24 por 12 le saca 12 unidades a lo que hay.
                    hint={(unidades) => textoDelta(unidades - (Number(c.cantidad) || 0))}
                    onCancel={() => setEditando(null)}
                    onConfirm={(cantidad, costo) => editar(c, cantidad, costo)}
                  />
                </li>
              ) : (
                <li className="stock-compra" key={c.id}>
                  <span className="muted">{c.fecha ? formatDateNumeric(c.fecha) : ''}</span>
                  <span className="stock-compra__nombre">{c.nombre}</span>
                  <span className="stock-row__num">+{c.cantidad}</span>
                  <span className="stock-row__num">{formatMoney(c.costo)} c/u</span>
                  <span className="stock-row__num">
                    {formatMoney((Number(c.cantidad) || 0) * (Number(c.costo) || 0))}
                  </span>
                  {modoEdicion && (
                    <>
                      <button
                        className="stock-row__compra"
                        onClick={() => setEditando(c.id)}
                        title={`Corregir la compra de ${c.nombre}`}
                        aria-label="Corregir compra"
                      >
                        ✎
                      </button>
                      <BotonBorrar
                        onConfirm={() => deshacer(c)}
                        label="Deshacer compra"
                        title="Deshacer la compra: saca del stock lo que había sumado"
                      />
                    </>
                  )}
                </li>
              ),
            )}
          </ul>
        </section>
      )}
    </Pantalla>
  )
}

const textoDelta = (delta) =>
  delta === 0
    ? 'Las unidades quedan como están.'
    : delta > 0
      ? `Se suman ${delta} unidades al stock.`
      : `Se sacan ${Math.abs(delta)} unidades del stock.`

/**
 * Alta o corrección de una compra: cuántas unidades entraron y a qué costo cada
 * una. El costo arranca en el de la compra anterior, que casi siempre es el
 * mismo. `hint` recibe las unidades escritas y devuelve la línea de ayuda.
 */
function CompraForm({
  titulo,
  cantidadInicial = '',
  costoInicial,
  textoConfirmar,
  hint,
  onCancel,
  onConfirm,
}) {
  const [cantidad, setCantidad] = useState(String(cantidadInicial ?? ''))
  const [costo, setCosto] = useState(String(costoInicial || ''))

  const unidades = Number(cantidad) || 0
  const costoUnit = Number(costo) || 0

  return (
    <div className="stock-compra-form">
      <p className="dividir__head">{titulo}</p>
      <div className="stock-compra-form__campos">
        <label className="stock-label">
          Cantidad
          <input
            className="cfg-input cfg-input--price"
            inputMode="numeric"
            autoFocus
            value={cantidad}
            onChange={(e) => setCantidad(soloDigitos(e.target.value))}
          />
        </label>
        <label className="stock-label">
          Compra c/u
          <input
            className="cfg-input cfg-input--price"
            inputMode="numeric"
            value={costo}
            onChange={(e) => setCosto(soloDigitos(e.target.value))}
          />
        </label>
        <span className="stock-compra-form__total">{formatMoney(unidades * costoUnit)}</span>
      </div>
      {hint && <p className="cfg-hint">{hint(unidades)}</p>}
      <div className="dividir__acciones">
        <button
          className="btn btn--primary"
          disabled={unidades <= 0}
          onClick={() => onConfirm(unidades, costoUnit)}
        >
          {textoConfirmar}
        </button>
        <button className="btn btn--ghost-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
