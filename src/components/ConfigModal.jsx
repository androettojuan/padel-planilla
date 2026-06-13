import { useState } from 'react'
import { uid, normalizeTime } from '../utils/helpers'

export default function ConfigModal({ config, onSave, onClose }) {
  const [draft, setDraft] = useState(() => structuredClone(config))
  const [saving, setSaving] = useState(false)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // ---- Canchas ----
  const addCancha = () =>
    set({ canchas: [...draft.canchas, { id: uid(), nombre: `Cancha ${draft.canchas.length + 1}` }] })
  const updateCancha = (id, nombre) =>
    set({ canchas: draft.canchas.map((c) => (c.id === id ? { ...c, nombre } : c)) })
  const removeCancha = (id) => set({ canchas: draft.canchas.filter((c) => c.id !== id) })

  // ---- Horarios ----
  const addHorario = () => {
    const last = draft.horarios[draft.horarios.length - 1]
    set({ horarios: [...draft.horarios, { id: uid(), desde: last?.hasta || '', hasta: '' }] })
  }
  const updateHorario = (id, patch) =>
    set({ horarios: draft.horarios.map((h) => (h.id === id ? { ...h, ...patch } : h)) })
  const removeHorario = (id) => set({ horarios: draft.horarios.filter((h) => h.id !== id) })
  const moveHorario = (idx, dir) => {
    const arr = [...draft.horarios]
    const j = idx + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    set({ horarios: arr })
  }
  const sortHorarios = () =>
    set({ horarios: [...draft.horarios].sort((a, b) => (a.desde || '').localeCompare(b.desde || '')) })

  // ---- Productos ----
  const addProducto = () =>
    set({ productos: [...(draft.productos || []), { id: uid(), nombre: '', precio: 0 }] })
  const updateProducto = (id, patch) =>
    set({ productos: draft.productos.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const removeProducto = (id) => set({ productos: draft.productos.filter((p) => p.id !== id) })

  const handleSave = async () => {
    setSaving(true)
    const clean = {
      ...draft,
      horarios: draft.horarios.map((h) => ({
        ...h,
        desde: normalizeTime(h.desde),
        hasta: normalizeTime(h.hasta),
      })),
      productos: (draft.productos || []).map((p) => ({ ...p, precio: Number(p.precio) || 0 })),
    }
    try {
      await onSave(clean)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Configuración</h2>
          <button className="player__del" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal__body">
          {/* Club */}
          <section className="cfg-section">
            <h3 className="cfg-section__title">Club</h3>
            <div className="cfg-row">
              <input
                className="cfg-input"
                placeholder="Nombre del club"
                value={draft.club?.nombre || ''}
                onChange={(e) => set({ club: { ...draft.club, nombre: e.target.value } })}
              />
              <input
                className="cfg-input"
                placeholder="Ubicación"
                value={draft.club?.ubicacion || ''}
                onChange={(e) => set({ club: { ...draft.club, ubicacion: e.target.value } })}
              />
            </div>
          </section>

          {/* Canchas */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Canchas</h3>
              <button className="btn btn--add" onClick={addCancha}>
                + Cancha
              </button>
            </div>
            {draft.canchas.map((c) => (
              <div className="cfg-row" key={c.id}>
                <input
                  className="cfg-input"
                  value={c.nombre}
                  placeholder="Nombre de la cancha"
                  onChange={(e) => updateCancha(c.id, e.target.value)}
                />
                <button className="player__del" onClick={() => removeCancha(c.id)} aria-label="Quitar">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* Horarios */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Franjas horarias</h3>
              <div className="cfg-actions">
                <button className="btn btn--add" onClick={sortHorarios}>
                  Ordenar
                </button>
                <button className="btn btn--add" onClick={addHorario}>
                  + Franja
                </button>
              </div>
            </div>
            <p className="cfg-hint">
              Cada franja es independiente: podés mezclar turnos de 1 h, 1 h 30 o lo que necesites.
            </p>
            {draft.horarios.map((h, idx) => (
              <div className="cfg-row cfg-row--horario" key={h.id}>
                <input
                  className="cfg-input cfg-input--time"
                  placeholder="14:00"
                  value={h.desde || ''}
                  onChange={(e) => updateHorario(h.id, { desde: e.target.value })}
                  onBlur={(e) => updateHorario(h.id, { desde: normalizeTime(e.target.value) })}
                />
                <span className="cfg-sep">a</span>
                <input
                  className="cfg-input cfg-input--time"
                  placeholder="15:30"
                  value={h.hasta || ''}
                  onChange={(e) => updateHorario(h.id, { hasta: e.target.value })}
                  onBlur={(e) => updateHorario(h.id, { hasta: normalizeTime(e.target.value) })}
                />
                <div className="cfg-move">
                  <button className="qty-btn" onClick={() => moveHorario(idx, -1)} aria-label="Subir">
                    ↑
                  </button>
                  <button className="qty-btn" onClick={() => moveHorario(idx, 1)} aria-label="Bajar">
                    ↓
                  </button>
                </div>
                <button className="player__del" onClick={() => removeHorario(h.id)} aria-label="Quitar">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* Productos */}
          <section className="cfg-section">
            <div className="cfg-section__head">
              <h3 className="cfg-section__title">Productos</h3>
              <button className="btn btn--add" onClick={addProducto}>
                + Producto
              </button>
            </div>
            {(draft.productos || []).map((p) => (
              <div className="cfg-row cfg-row--producto" key={p.id}>
                <input
                  className="cfg-input"
                  placeholder="Nombre del producto"
                  value={p.nombre}
                  onChange={(e) => updateProducto(p.id, { nombre: e.target.value })}
                />
                <input
                  className="cfg-input cfg-input--price"
                  inputMode="numeric"
                  placeholder="$"
                  value={p.precio}
                  onChange={(e) => updateProducto(p.id, { precio: e.target.value.replace(/[^\d]/g, '') })}
                />
                <button className="player__del" onClick={() => removeProducto(p.id)} aria-label="Quitar">
                  ×
                </button>
              </div>
            ))}
          </section>
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
