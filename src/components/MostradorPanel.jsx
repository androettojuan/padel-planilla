import { useState } from 'react'
import { PAGOS, PAGOS_BY_ID } from '../data/defaults'
import { uid, formatMoney } from '../utils/helpers'
import NombreInput from './NombreInput'

// Cuentas de gente que no está jugando (bar / mostrador). Cada cuenta es
// independiente: tiene sus propios consumos y se cobra por separado.
export default function MostradorPanel({ config, planilla, update, sugerencias, onCommitNombre }) {
  const productos = config.productos || []
  const cuentas = planilla.mostrador || []
  const [nombre, setNombre] = useState('')
  const [cobrando, setCobrando] = useState(null) // id de la cuenta cobrándose
  const [verPagadas, setVerPagadas] = useState(false)

  const subtotal = (tab) =>
    (tab.items || []).reduce((s, it) => s + (Number(it.precio) || 0) * (Number(it.cantidad) || 0), 0)

  const setCuentas = (fn) => update((prev) => ({ ...prev, mostrador: fn(prev.mostrador || []) }))
  const patchTab = (id, patch) =>
    setCuentas((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const addCuenta = () => {
    const n = nombre.trim()
    if (!n) return
    setCuentas((list) => [...list, { id: uid(), nombre: n, items: [], pagado: false }])
    setNombre('')
  }

  const removeCuenta = (id) => setCuentas((list) => list.filter((t) => t.id !== id))

  const addItem = (tab, productoId) => {
    const prod = productos.find((p) => p.id === productoId)
    if (!prod) return
    patchTab(tab.id, {
      items: [
        ...(tab.items || []),
        { id: uid(), productoId: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 },
      ],
    })
  }
  const updateItem = (tab, itemId, patch) =>
    patchTab(tab.id, {
      items: (tab.items || []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    })
  const removeItem = (tab, itemId) =>
    patchTab(tab.id, { items: (tab.items || []).filter((it) => it.id !== itemId) })

  const confirmar = (id, medio) => {
    patchTab(id, { pagado: true, pago: medio })
    setCobrando(null)
  }
  const revertir = (id) => patchTab(id, { pagado: false, pago: null })

  const pendientes = cuentas.filter((t) => !t.pagado)
  const pagadas = cuentas.filter((t) => t.pagado)
  const totalPendiente = pendientes.reduce((s, t) => s + subtotal(t), 0)
  const totalPagado = pagadas.reduce((s, t) => s + subtotal(t), 0)

  return (
    <div className="mostrador">
      <div className="section-head">
        <h2 className="section-title">Bar / Mostrador</h2>
        {totalPendiente > 0 && (
          <span className="cuentas__pend">{formatMoney(totalPendiente)} pendiente</span>
        )}
      </div>

      <div className="cuentas__card">
        <div className="mostrador__add">
          <NombreInput
            className="consumos__player"
            placeholder="Nombre o mesa (no juega)"
            value={nombre}
            sugerencias={sugerencias}
            onChange={setNombre}
            onCommit={onCommitNombre}
            onEnter={addCuenta}
          />
          <button className="btn btn--primary" onClick={addCuenta}>
            Agregar
          </button>
        </div>

        {pendientes.length === 0 ? (
          <p className="consumos__empty muted">
            {pagadas.length > 0
              ? 'No hay cuentas de mostrador pendientes.'
              : 'Agregá una persona o mesa para cargarle consumos.'}
          </p>
        ) : (
          <ul className="cuentas__list">
            {pendientes.map((tab) => (
              <MostradorCuenta
                key={tab.id}
                tab={tab}
                productos={productos}
                total={subtotal(tab)}
                cobrando={cobrando === tab.id}
                onAddItem={(pid) => addItem(tab, pid)}
                onUpdateItem={(itemId, patch) => updateItem(tab, itemId, patch)}
                onRemoveItem={(itemId) => removeItem(tab, itemId)}
                onRemove={() => removeCuenta(tab.id)}
                onStartCobro={() => setCobrando(tab.id)}
                onCancelCobro={() => setCobrando(null)}
                onConfirm={(medio) => confirmar(tab.id, medio)}
              />
            ))}
          </ul>
        )}

        {pagadas.length > 0 && (
          <div className="cuentas__pagadas">
            <button className="cuentas__toggle" onClick={() => setVerPagadas((v) => !v)}>
              <span>
                {verPagadas ? '▾' : '▸'} Pagadas ({pagadas.length})
              </span>
              <span className="cuentas__toggle-total">{formatMoney(totalPagado)}</span>
            </button>
            {verPagadas && (
              <ul className="cuentas__list cuentas__list--pagadas">
                {pagadas.map((tab) => {
                  const medio = tab.pago ? PAGOS_BY_ID[tab.pago] : null
                  return (
                    <li className="cuenta cuenta--pagada" key={tab.id}>
                      <div className="cuenta__head">
                        <span className="cuenta__name">{tab.nombre}</span>
                        <span className="cuenta__total">{formatMoney(subtotal(tab))}</span>
                      </div>
                      <div className="cuenta__paid">
                        <span className="pago pago--sm" style={{ '--pago-color': medio?.color }}>
                          ✓ {medio?.label || 'Pagado'}
                        </span>
                        <button className="btn btn--ghost-sm" onClick={() => revertir(tab.id)}>
                          Revertir
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MostradorCuenta({
  tab,
  productos,
  total,
  cobrando,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onRemove,
  onStartCobro,
  onCancelCobro,
  onConfirm,
}) {
  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  const items = tab.items || []

  return (
    <li className="cuenta">
      <div className="cuenta__head">
        <span className="cuenta__name">{tab.nombre}</span>
        <span className="cuenta__total">{formatMoney(total)}</span>
        <button className="player__del" onClick={onRemove} aria-label="Quitar cuenta">
          ×
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mostrador__items">
          {items.map((it) => (
            <li className="consumo consumo--mini" key={it.id}>
              <span className="consumo__name">{it.nombre}</span>
              <div className="consumo__qty">
                <button
                  className="qty-btn"
                  onClick={() => onUpdateItem(it.id, { cantidad: Math.max(1, (Number(it.cantidad) || 1) - 1) })}
                >
                  −
                </button>
                <span className="qty-value">{it.cantidad}</span>
                <button
                  className="qty-btn"
                  onClick={() => onUpdateItem(it.id, { cantidad: (Number(it.cantidad) || 1) + 1 })}
                >
                  +
                </button>
              </div>
              <span className="consumo__sub">
                {formatMoney((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}
              </span>
              <button className="player__del" onClick={() => onRemoveItem(it.id)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mostrador__addItem">
        <select
          className="consumos__product"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
        >
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {formatMoney(p.precio)}
            </option>
          ))}
        </select>
        <button className="btn btn--add" onClick={() => onAddItem(productoId)}>
          + Consumo
        </button>
      </div>

      {cobrando ? (
        <div className="cuenta__medios">
          {PAGOS.map((p) => (
            <button
              key={p.id}
              className="medio-btn"
              style={{ '--pago-color': p.color }}
              onClick={() => onConfirm(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button className="btn btn--ghost-sm" onClick={onCancelCobro}>
            Cancelar
          </button>
        </div>
      ) : (
        <button
          className="btn btn--primary cuenta__cobrar"
          disabled={items.length === 0}
          onClick={onStartCobro}
        >
          Confirmar pago
        </button>
      )}
    </li>
  )
}
