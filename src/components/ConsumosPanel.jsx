import { useState } from 'react'
import { PAGOS_BY_ID } from '../data/defaults'
import { formatMoney } from '../utils/helpers'
import {
  grupoDe,
  jugadoresDe,
  lineaMostrador,
  lineasConsumo,
  nombresUnicos,
  precioOriginal,
  redividirConsumo,
  repartirMonto,
  setCantidadConsumo,
} from '../utils/consumos'
import { cantidadDe, costoDe, unidadesPorProducto } from '../utils/stock'
import BotonBorrar from './BotonBorrar'
import NombreInput from './NombreInput'

export default function ConsumosPanel({
  config,
  planilla,
  update,
  sugerencias,
  onCommitNombre,
  stock = {},
  onStock,
}) {
  const productos = config.productos || []
  // Solo se listan los consumos sin cobrar; al cerrar la cuenta del jugador
  // quedan pagados y salen de esta vista (siguen sumando en los totales del día).
  const todos = planilla.consumos || []
  const consumos = todos.filter((c) => !c.pagado)
  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  const [jugador, setJugador] = useState('')
  // Jugadores agregados con "+" para repartir el consumo que se está cargando.
  const [reparto, setReparto] = useState([])
  // Entre cuántos se divide. Se puede subir sin cargar nombres: el club que solo
  // anota al que reserva parte una cerveza en tres y cobra cada parte por su lado.
  const [partes, setPartes] = useState(1)
  // Id del consumo cuyo formulario de división está abierto.
  const [dividiendo, setDividiendo] = useState(null)

  const producto = productos.find((p) => p.id === productoId)
  const totalConsumos = consumos.reduce(
    (s, c) => s + (Number(c.precio) || 0) * (Number(c.cantidad) || 0),
    0,
  )

  // Los del "+" más lo que haya quedado escrito en el input.
  const nombresACargar = nombresUnicos([...reparto, jugador])
  // Nunca menos partes que nombres cargados: cada uno tiene que tener la suya.
  const enCuantas = Math.max(partes, nombresACargar.length)

  const sumarAlReparto = () => {
    const nombre = jugador.trim()
    if (!nombre) return
    setReparto((prev) => nombresUnicos([...prev, nombre]))
    setJugador('')
  }

  // Mueve el stock si el producto está bajo control. Negativo al vender.
  const moverStock = (deltas) => onStock && onStock(deltas)

  const addConsumo = () => {
    if (!producto) return
    const base = {
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      // Costo con el que entró la mercadería, guardado en la línea: la ganancia
      // del mes se calcula con el costo del día de la venta, no con el de hoy.
      costo: costoDe(stock, producto.id),
    }
    // Sin ningún jugador el consumo se carga como venta de mostrador: alguien que
    // no estaba jugando y se llevó algo. Queda marcado para no confundirlo con un
    // consumo al que se olvidaron de ponerle el nombre.
    const nuevas =
      nombresACargar.length || enCuantas > 1
        ? lineasConsumo(base, nombresACargar, 1, enCuantas)
        : [{ ...lineaMostrador(base) }]
    if (!nuevas.length) return
    update((prev) => ({ ...prev, consumos: [...(prev.consumos || []), ...nuevas] }))
    // Un producto compartido sale una sola vez del stock, aunque sean varias líneas.
    const unidades = unidadesPorProducto(nuevas, nuevas)
    moverStock(Object.fromEntries(Object.entries(unidades).map(([id, n]) => [id, -n])))
    setJugador('')
    setReparto([])
    setPartes(1)
  }

  const setCantidad = (consumo, cantidad) => {
    const nueva = Math.max(1, Number(cantidad) || 1)
    const vieja = Math.max(1, Number(consumo.cantidad) || 1)
    if (nueva === vieja) return
    moverStock({ [consumo.productoId]: vieja - nueva })
    update((prev) => setCantidadConsumo(prev, consumo, nueva))
  }

  const removeConsumo = (consumo) => {
    // La mercadería vuelve al stock solo al borrar la última parte: mientras
    // quede alguna, el producto se consumió igual y no volvió a la heladera.
    if (grupoDe(todos, consumo).length <= 1) {
      moverStock({ [consumo.productoId]: Math.max(1, Number(consumo.cantidad) || 1) })
    }
    update((prev) => ({ ...prev, consumos: (prev.consumos || []).filter((c) => c.id !== consumo.id) }))
  }

  const dividir = (consumo, nombres) => {
    update((prev) => redividirConsumo(prev, consumo, nombres))
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
        {reparto.length > 0 && (
          <ul className="reparto">
            {reparto.map((n) => (
              <li className="reparto__chip" key={n}>
                {n}
                <button
                  className="reparto__del"
                  onClick={() => setReparto((prev) => prev.filter((x) => x !== n))}
                  aria-label={`Quitar ${n}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="consumos__row">
          <NombreInput
            className="consumos__player"
            placeholder="Jugador"
            value={jugador}
            sugerencias={sugerencias}
            onChange={setJugador}
            onCommit={onCommitNombre}
            onEnter={addConsumo}
          />
          <button
            className="btn btn--ghost-sm reparto__add"
            onClick={sumarAlReparto}
            disabled={!jugador.trim()}
            title="Sumar otro jugador para dividir el consumo"
          >
            +
          </button>
        </div>
        <select
          className="consumos__product"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
        >
          {productos.map((p) => {
            // De los productos con stock cargado se ve cuánto queda; los que no
            // se controlan (alquiler de paletas y demás) se listan como siempre.
            const queda = cantidadDe(stock, p.id)
            return (
              <option key={p.id} value={p.id}>
                {p.nombre} · {formatMoney(p.precio)}
                {queda === null ? '' : queda > 0 ? ` · quedan ${queda}` : ' · sin stock'}
              </option>
            )
          })}
        </select>
        <div className="partes">
          <span className="partes__label">Dividir entre</span>
          <button
            className="qty-btn"
            onClick={() => setPartes((n) => Math.max(1, n - 1))}
            disabled={enCuantas <= 1 || enCuantas <= nombresACargar.length}
            aria-label="Entre menos"
          >
            −
          </button>
          <span className="qty-value">{enCuantas}</span>
          <button
            className="qty-btn"
            onClick={() => setPartes(enCuantas + 1)}
            aria-label="Entre más"
          >
            +
          </button>
        </div>
        {enCuantas > 1 && producto && (
          <p className="reparto__hint muted">
            {formatMoney(producto.precio)} ÷ {enCuantas} ={' '}
            {repartirMonto(producto.precio, enCuantas)
              .map((p) => formatMoney(p))
              .join(' · ')}
          </p>
        )}
        <button className="btn btn--primary" onClick={addConsumo}>
          {enCuantas > 1
            ? `Agregar dividido entre ${enCuantas}`
            : nombresACargar.length === 0
              ? 'Agregar al mostrador'
              : 'Agregar'}
        </button>
        {enCuantas === 1 && nombresACargar.length === 0 && (
          <p className="reparto__hint muted">
            Sin jugador se anota como venta de mostrador: alguien que no estaba jugando.
          </p>
        )}
        {enCuantas > 1 && nombresACargar.length < enCuantas && (
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
            // Con una parte ya cobrada el reparto queda firme: para cambiarlo
            // hay que revertir ese pago desde el panel de cuentas.
            const cobrado = grupoDe(todos, c).some((x) => x.pagado)
            return (
            <li className={`consumo ${c.pagado ? 'consumo--pagado' : ''}`} key={c.id}>
              <div className="consumo__info">
                <span className="consumo__name">
                  {c.nombre}
                  {partido && (
                    <span
                      className="consumo__parte"
                      title={`Dividido entre ${c.parte.de}: ${jugadoresDe(todos, c).join(', ')}`}
                    >
                      {c.parte.n}/{c.parte.de}
                    </span>
                  )}
                </span>
                {c.mostrador ? (
                  <span className="consumo__player consumo__player--mostrador">
                    Mostrador · no jugaba
                  </span>
                ) : (
                  c.jugador && <span className="consumo__player">{c.jugador}</span>
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
                  jugadores={jugadoresDe(todos, c)}
                  precio={precioOriginal(todos, c)}
                  sugerencias={sugerencias}
                  onCommitNombre={onCommitNombre}
                  onCancel={() => setDividiendo(null)}
                  onConfirm={(nombres) => dividir(c, nombres)}
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
 * Formulario para repartir un consumo ya cargado. Arranca con los jugadores que
 * ya lo comparten y se les suman o quitan otros; al confirmar, el precio del
 * producto se vuelve a dividir en partes iguales entre los que queden.
 */
function DividirForm({ jugadores, precio, sugerencias, onCommitNombre, onCancel, onConfirm }) {
  const [nombres, setNombres] = useState(jugadores)
  const [texto, setTexto] = useState('')

  const lista = nombresUnicos([...nombres, texto])
  const partes = repartirMonto(precio, Math.max(1, lista.length))
  // Cuando el precio no se divide justo, las partes difieren en unos pesos y
  // conviene mostrarlas todas en vez de un "cada uno" que sería mentira.
  const parejo = partes.every((p) => p === partes[0])

  const sumar = () => {
    const nombre = texto.trim()
    if (!nombre) return
    setNombres((prev) => nombresUnicos([...prev, nombre]))
    setTexto('')
  }

  return (
    <div className="dividir">
      <p className="dividir__head">
        Dividir {formatMoney(precio)} entre {lista.length}
        {lista.length > 1 && (
          <>
            {' · '}
            {parejo
              ? `${formatMoney(partes[0])} cada uno`
              : partes.map((p) => formatMoney(p)).join(' · ')}
          </>
        )}
      </p>
      <ul className="reparto">
        {nombres.map((n) => (
          <li className="reparto__chip" key={n}>
            {n}
            <button
              className="reparto__del"
              onClick={() => setNombres((prev) => prev.filter((x) => x !== n))}
              aria-label={`Quitar ${n}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="consumos__row">
        <NombreInput
          className="consumos__player"
          placeholder="Sumar jugador"
          value={texto}
          sugerencias={sugerencias}
          onChange={setTexto}
          onCommit={onCommitNombre}
          onEnter={sumar}
        />
        <button className="btn btn--ghost-sm reparto__add" onClick={sumar} disabled={!texto.trim()}>
          +
        </button>
      </div>
      <div className="dividir__acciones">
        <button
          className="btn btn--primary"
          onClick={() => onConfirm(lista)}
          disabled={lista.length === 0}
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
