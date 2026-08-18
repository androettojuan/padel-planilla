import { useState } from 'react'
import { PAGOS_BY_ID } from '../data/defaults'
import { formatMoney } from '../utils/helpers'
import {
  duenioDeGrupo,
  grupoDe,
  jugadoresDeGrupo,
  lineasNuevoConsumo,
  precioDeGrupo,
  redividirConsumo,
  repartirMonto,
  setCantidadConsumo,
} from '../utils/consumos'
import { costoDe } from '../utils/stock'
import BotonBorrar from './BotonBorrar'
import ProductoInput from './ProductoInput'
import { RepartoChips, RepartoInput, useReparto } from './Reparto'

export default function ConsumosPanel({
  config,
  planilla,
  update,
  sugerencias,
  onCommitNombre,
  stock = {},
  onStock = () => {},
}) {
  const productos = config.productos || []
  // Solo se listan los consumos sin cobrar; al cerrar la cuenta del jugador
  // quedan pagados y salen de esta vista (siguen sumando en los totales del día).
  const todos = planilla.consumos || []
  const consumos = todos.filter((c) => !c.pagado)
  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  // Entre quiénes (y en cuántas partes) se divide el consumo que se está cargando.
  const reparto = useReparto()
  // Id del consumo cuyo formulario de división está abierto.
  const [dividiendo, setDividiendo] = useState(null)

  const producto = productos.find((p) => p.id === productoId)
  const totalConsumos = consumos.reduce(
    (s, c) => s + (Number(c.precio) || 0) * (Number(c.cantidad) || 0),
    0,
  )

  const addConsumo = () => {
    if (!producto) return
    const nuevas = lineasNuevoConsumo(
      {
        productoId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        // Costo con el que entró la mercadería, guardado en la línea: la ganancia
        // del mes se calcula con el costo del día de la venta, no con el de hoy.
        costo: costoDe(stock, producto.id),
      },
      reparto.lista,
      1,
      reparto.total,
    )
    if (!nuevas.length) return
    update((prev) => ({ ...prev, consumos: [...(prev.consumos || []), ...nuevas] }))
    // Un producto compartido sale una sola vez del stock, aunque sean varias líneas.
    onStock({ [producto.id]: -1 })
    reparto.limpiar()
  }

  const setCantidad = (consumo, cantidad) => {
    const nueva = Math.max(1, Number(cantidad) || 1)
    const vieja = Math.max(1, Number(consumo.cantidad) || 1)
    if (nueva === vieja) return
    onStock({ [consumo.productoId]: vieja - nueva })
    update((prev) => setCantidadConsumo(prev, consumo, nueva))
  }

  const removeConsumo = (consumo) => {
    // La mercadería vuelve al stock solo al borrar la última parte: mientras
    // quede alguna, el producto se consumió igual y no volvió a la heladera.
    if (grupoDe(todos, consumo).length <= 1) {
      onStock({ [consumo.productoId]: Math.max(1, Number(consumo.cantidad) || 1) })
    }
    update((prev) => ({
      ...prev,
      consumos: (prev.consumos || []).filter((c) => c.id !== consumo.id),
    }))
  }

  const dividir = (consumo, nombres, partesNuevas) => {
    update((prev) => redividirConsumo(prev, consumo, nombres, partesNuevas))
    setDividiendo(null)
  }

  return (
    <div className="consumos">
      <div className="section-head">
        <h2 className="section-title">Consumos</h2>
        <span className="consumos__total">{formatMoney(totalConsumos)}</span>
      </div>

      <div className="consumos__card">
        <div className="consumos__form">
          <RepartoChips reparto={reparto} />
          <RepartoInput
            reparto={reparto}
            sugerencias={sugerencias}
            onCommitNombre={onCommitNombre}
            onEnter={addConsumo}
          />
          <ProductoInput
            className="consumos__product"
            productos={productos}
            stock={stock}
            value={productoId}
            onChange={setProductoId}
            onEnter={addConsumo}
          />
          {reparto.total > 1 && producto && (
            <p className="reparto__hint muted">
              {formatMoney(producto.precio)} ÷ {reparto.total} ={' '}
              {repartirMonto(producto.precio, reparto.total)
                .map((p) => formatMoney(p))
                .join(' · ')}
            </p>
          )}
          <button className="btn btn--primary" onClick={addConsumo}>
            {reparto.total > 1
              ? `Agregar dividido entre ${reparto.total}`
              : reparto.lista.length === 0
                ? 'Agregar al mostrador'
                : 'Agregar'}
          </button>
          {reparto.total === 1 && reparto.lista.length === 0 && (
            <p className="reparto__hint muted">
              Sin jugador se anota como venta de mostrador: alguien que no estaba jugando.
            </p>
          )}
          {reparto.total > 1 && reparto.lista.length < reparto.total && (
            <p className="reparto__hint muted">
              Las partes sin nombre se cobran cada una por su lado.
            </p>
          )}
        </div>

        {consumos.length === 0 ? (
          <p className="consumos__empty muted">Todavía no hay consumos cargados.</p>
        ) : (
          <ul className="consumos__list">
            {consumos.map((c) => {
              const medio = c.pagado ? PAGOS_BY_ID[c.pago] : null
              const partido = c.parte?.de > 1
              // El grupo se arma una sola vez: recorre todos los consumos, y de él
              // salen el estado de cobro, los jugadores, el dueño y el precio entero.
              const grupo = grupoDe(todos, c)
              // Con una parte ya cobrada el reparto queda firme: para cambiarlo
              // hay que revertir ese pago desde el panel de cuentas.
              const cobrado = grupo.some((x) => x.pagado)
              const jugadores = jugadoresDeGrupo(grupo)
              // Una parte sin nombre igual se sabe de quién es: del que tiene
              // nombre en el mismo producto compartido.
              const duenio = c.jugador ? '' : duenioDeGrupo(grupo)
              return (
                <li className={`consumo ${c.pagado ? 'consumo--pagado' : ''}`} key={c.id}>
                  <div className="consumo__info">
                    <span className="consumo__name">
                      {c.nombre}
                      {partido && (
                        <span
                          className="consumo__parte"
                          title={`Dividido entre ${c.parte.de}: ${jugadores.join(', ')}`}
                        >
                          {c.parte.n}/{c.parte.de}
                        </span>
                      )}
                    </span>
                    {c.mostrador ? (
                      <span className="consumo__player consumo__player--mostrador">
                        Mostrador · no jugaba
                      </span>
                    ) : c.jugador ? (
                      <span className="consumo__player">{c.jugador}</span>
                    ) : (
                      duenio && <span className="consumo__player consumo__player--ref">de {duenio}</span>
                    )}
                  </div>
                  <div className="consumo__qty">
                    <button
                      className="qty-btn"
                      disabled={c.pagado}
                      onClick={() => setCantidad(c, (Number(c.cantidad) || 1) - 1)}
                    >
                      −
                    </button>
                    <span className="qty-value">{c.cantidad}</span>
                    <button
                      className="qty-btn"
                      disabled={c.pagado}
                      onClick={() => setCantidad(c, (Number(c.cantidad) || 1) + 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="consumo__sub">
                    {formatMoney((Number(c.precio) || 0) * (Number(c.cantidad) || 0))}
                  </span>
                  {c.pagado ? (
                    <span
                      className="pago pago--sm pago--lock"
                      style={{ '--pago-color': medio?.color }}
                      title={`Pagado · ${medio?.label || ''}`}
                    >
                      ✓ {medio?.short || 'OK'}
                    </span>
                  ) : (
                    <>
                      {/* Una venta de mostrador no se divide: no hay jugadores. */}
                      <button
                        className="consumo__split"
                        hidden={c.mostrador}
                        disabled={cobrado}
                        onClick={() => setDividiendo(dividiendo === c.id ? null : c.id)}
                        title={
                          cobrado
                            ? 'Ya se cobró una parte: revertí ese pago para cambiar la división'
                            : partido
                              ? 'Cambiar entre quiénes se divide'
                              : 'Dividir entre varios jugadores'
                        }
                        aria-label="Dividir"
                      >
                        ÷
                      </button>
                      <BotonBorrar
                        onConfirm={() => removeConsumo(c)}
                        title={partido ? 'Quitar esta parte' : 'Quitar consumo'}
                      />
                    </>
                  )}

                  {dividiendo === c.id && (
                    <DividirForm
                      jugadores={jugadores}
                      precio={precioDeGrupo(grupo)}
                      sugerencias={sugerencias}
                      onCommitNombre={onCommitNombre}
                      onCancel={() => setDividiendo(null)}
                      onConfirm={(nombres, partesNuevas) => dividir(c, nombres, partesNuevas)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Formulario para repartir un consumo ya cargado. Se elige entre cuántos va y,
 * si hace falta, quiénes: el nombre sirve para el que tiene cuenta en el club,
 * pero al que paga en efectivo o con Mercado Pago no hay por qué pedírselo.
 */
function DividirForm({ jugadores, precio, sugerencias, onCommitNombre, onCancel, onConfirm }) {
  const reparto = useReparto(jugadores)
  const montos = repartirMonto(precio, Math.max(1, reparto.total))
  // Cuando el precio no se divide justo, las partes difieren en unos pesos y
  // conviene mostrarlas todas en vez de un "cada uno" que sería mentira.
  const parejo = montos.every((p) => p === montos[0])

  return (
    <div className="dividir">
      <p className="dividir__head">
        Dividir {formatMoney(precio)} entre {reparto.total}
        {reparto.total > 1 && (
          <>
            {' · '}
            {parejo
              ? `${formatMoney(montos[0])} cada uno`
              : montos.map((p) => formatMoney(p)).join(' · ')}
          </>
        )}
      </p>
      <RepartoChips reparto={reparto} />
      <RepartoInput
        reparto={reparto}
        sugerencias={sugerencias}
        onCommitNombre={onCommitNombre}
        placeholder="Sumar jugador (opcional)"
      />
      <p className="reparto__hint muted">
        El “+” suma el nombre que escribas; vacío, agrega una parte más sin nombre.
      </p>
      <div className="dividir__acciones">
        <button
          className="btn btn--primary"
          onClick={() => onConfirm(reparto.lista, reparto.total)}
        >
          Confirmar
        </button>
        <button className="btn btn--ghost-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
