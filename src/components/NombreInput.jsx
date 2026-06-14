import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Input de nombre con sugerencias mientras se escribe. Las sugerencias salen de
 * `sugerencias` (directorio + nombres ya cargados). Al confirmar un nombre
 * (Enter, blur o elegir una sugerencia) se llama `onCommit`, que usamos para el
 * alta automática en el directorio.
 *
 * El menú se renderiza con un portal y posición fija para que no lo recorte el
 * scroll horizontal de la grilla de turnos.
 */
export default function NombreInput({
  value,
  onChange,
  onCommit,
  onEnter,
  sugerencias = [],
  placeholder = 'Nombre',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const [pos, setPos] = useState(null)
  const inputRef = useRef(null)
  const blurTimer = useRef(null)

  const filtradas = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    // Sin texto no sugerimos nada: el menú recién aparece al empezar a escribir.
    if (!q) return []
    const list = sugerencias.filter(Boolean).filter((n) => {
      const ln = n.toLowerCase()
      return ln.includes(q) && ln !== q
    })
    return [...list]
      .sort((a, b) => {
        const aw = a.toLowerCase().startsWith(q) ? 0 : 1
        const bw = b.toLowerCase().startsWith(q) ? 0 : 1
        return aw - bw || a.localeCompare(b)
      })
      .slice(0, 8)
  }, [value, sugerencias])

  const place = () => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 2, width: r.width })
  }

  // Mientras está abierto, reposiciona el menú si hay scroll o resize.
  useEffect(() => {
    if (!open) return
    place()
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  const commit = (n) => onCommit && onCommit((n ?? '').trim())

  const select = (n) => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    onChange(n)
    commit(n)
    setOpen(false)
    setHi(-1)
  }

  const handleKeyDown = (e) => {
    const visible = open && filtradas.length > 0
    if (visible && e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => (h + 1) % filtradas.length)
      return
    }
    if (visible && e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => (h - 1 + filtradas.length) % filtradas.length)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setHi(-1)
      return
    }
    if (e.key === 'Enter') {
      if (visible && hi >= 0) {
        e.preventDefault()
        select(filtradas[hi])
        return
      }
      commit(value)
      setOpen(false)
      setHi(-1)
      onEnter && onEnter()
    }
  }

  return (
    <div className="nombre-input">
      <input
        ref={inputRef}
        className={className}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(-1)
        }}
        onFocus={() => {
          setOpen(true)
          place()
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            setOpen(false)
            setHi(-1)
            commit(value)
          }, 120)
        }}
        onKeyDown={handleKeyDown}
      />
      {open && pos && filtradas.length > 0 &&
        createPortal(
          <ul
            className="nombre-sug"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtradas.map((n, i) => (
              <li
                key={n}
                className={`nombre-sug__item ${i === hi ? 'is-active' : ''}`}
                onMouseDown={() => select(n)}
              >
                {n}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
