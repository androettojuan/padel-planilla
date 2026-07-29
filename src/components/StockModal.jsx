import { useEffect, useMemo, useState } from 'react'
import { formatMoney, formatDateNumeric, todayKey } from '../utils/helpers'
import { cantidadDe, costoDe, faltaReponer, valorStock } from '../utils/stock'
import { loadCompras } from '../firebase/stock'
import { useClubId } from '../hooks/useClub'

/**
 * Pantalla de stock: cuánto queda de cada producto, a qué costo entró y cuánta
 * plata hay inmovilizada. Desde acá se cargan las compras (que suman al stock y
 * dejan el costo nuevo), se corrige a mano lo que hay y se fija el mínimo con el
 * que el producto queda marcado para reponer.
 *
 * Los productos son los del club (Configuración); acá solo se maneja su stock.
 */
export default function StockModal({ config, stock, onComprar, onAjustar, onMinimo, onClose }) {
  const clubId = useClubId()
  const productos = config.productos || []
  const [compras, setCompras] = useState([])
  const [comprando, setComprando] = useState(null) // productoId con el form abierto
  const [error, setError] = useState(null)

  const recargarCompras = () => {
    loadCompras(clubId)
      .then(setCompras)
      .catch(() => {})
  }
  useEffect(recargarCompras, [clubId])

  const total = useMemo(() => valorStock(stock, productos), [stock, productos])
  const aReponer = productos.filter((p) => faltaReponer(stock, p.id))

  const comprar = async (producto, cantidad, costo) => {
    setError(null)
    try {
      await onComprar({
        productoId: producto.id,
        nombre: producto.nombre,
        cantidad,
        costo,
        fecha: todayKey(),
      })
      setComprando(null)
      recargarCompras()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Stock</h2>
          <button className="player__del" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal__body">
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

          {productos.length === 0 ? (
            <p className="cfg-hint">
              Todavía no hay productos cargados. Se agregan desde Configuración, y acá se les
              carga el stock.
            </p>
          ) : (
            <section className="cfg-section">
              <div className="cfg-section__head">
                <h3 className="cfg-section__title">Productos</h3>
              </div>
              <p className="cfg-hint">
                Un producto entra al control de stock cuando le cargás la primera compra. Hasta
                entonces se vende sin descontar nada.
              </p>

              <div className="stock-head">
                <span>Producto</span>
                <span>Queda</span>
                <span>Mínimo</span>
                <span>Costo</span>
                <span>Valor</span>
                <span />
              </div>

              {productos.map((p) => {
                const queda = cantidadDe(stock, p.id)
                const costo = costoDe(stock, p.id)
                const controlado = queda !== null
                return (
                  <div key={p.id}>
                    <div className={`stock-row ${faltaReponer(stock, p.id) ? 'stock-row--bajo' : ''}`}>
                      <span className="stock-row__nombre">{p.nombre}</span>
                      {controlado ? (
                        <input
                          className="cfg-input cfg-input--price"
                          inputMode="numeric"
                          value={queda}
                          aria-label={`Unidades de ${p.nombre}`}
                          onChange={(e) => onAjustar(p.id, e.target.value.replace(/[^\d]/g, ''))}
                        />
                      ) : (
                        <span className="muted stock-row__sin">sin control</span>
                      )}
                      {controlado && (
                        <input
                          className="cfg-input cfg-input--price"
                          inputMode="numeric"
                          value={stock[p.id]?.minimo || 0}
                          aria-label={`Mínimo de ${p.nombre}`}
                          onChange={(e) => onMinimo(p.id, e.target.value.replace(/[^\d]/g, ''))}
                        />
                      )}
                      <span className="stock-row__num">{controlado ? formatMoney(costo) : '—'}</span>
                      <span className="stock-row__num">
                        {controlado ? formatMoney(queda * costo) : '—'}
                      </span>
                      <button
                        className="stock-row__compra"
                        onClick={() => setComprando(comprando === p.id ? null : p.id)}
                        title={comprando === p.id ? 'Cancelar' : `Cargar compra de ${p.nombre}`}
                        aria-label={`Cargar compra de ${p.nombre}`}
                      >
                        {comprando === p.id ? '×' : '+'}
                      </button>
                    </div>

                    {comprando === p.id && (
                      <CompraForm
                        producto={p}
                        costoActual={costo}
                        onCancel={() => setComprando(null)}
                        onConfirm={(cantidad, costoUnit) => comprar(p, cantidad, costoUnit)}
                      />
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {compras.length > 0 && (
            <section className="cfg-section">
              <div className="cfg-section__head">
                <h3 className="cfg-section__title">Últimas compras</h3>
              </div>
              <ul className="stock-compras">
                {compras.map((c) => (
                  <li className="stock-compra" key={c.id}>
                    <span className="muted">{c.fecha ? formatDateNumeric(c.fecha) : ''}</span>
                    <span className="stock-compra__nombre">{c.nombre}</span>
                    <span className="stock-row__num">+{c.cantidad}</span>
                    <span className="stock-row__num">{formatMoney(c.costo)} c/u</span>
                    <span className="stock-row__num">
                      {formatMoney((Number(c.cantidad) || 0) * (Number(c.costo) || 0))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// Carga de una compra: cuántas unidades entraron y a qué costo cada una. El costo
// arranca en el de la compra anterior, que casi siempre es el mismo.
function CompraForm({ producto, costoActual, onCancel, onConfirm }) {
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState(String(costoActual || ''))

  const unidades = Number(cantidad) || 0
  const costoUnit = Number(costo) || 0
  const valido = unidades > 0

  return (
    <div className="stock-compra-form">
      <p className="dividir__head">Compra de {producto.nombre}</p>
      <div className="stock-compra-form__campos">
        <label className="stock-label">
          Cantidad
          <input
            className="cfg-input cfg-input--price"
            inputMode="numeric"
            autoFocus
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
        <label className="stock-label">
          Costo c/u
          <input
            className="cfg-input cfg-input--price"
            inputMode="numeric"
            value={costo}
            onChange={(e) => setCosto(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
        <span className="stock-compra-form__total">{formatMoney(unidades * costoUnit)}</span>
      </div>
      <div className="dividir__acciones">
        <button
          className="btn btn--primary"
          disabled={!valido}
          onClick={() => onConfirm(unidades, costoUnit)}
        >
          Cargar compra
        </button>
        <button className="btn btn--ghost-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
