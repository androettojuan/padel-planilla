import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeNombre, formatMoney } from '../utils/helpers'
import { cantidadDe } from '../utils/stock'

/**
 * Buscador de productos: se escribe para filtrar en vez de bajar una lista
 * larguísima. Los productos se listan siempre en orden alfabético, y cada uno
 * muestra el precio y, si se controla stock, cuántas unidades quedan.
 *
 * El menú va en un portal con posición fija, igual que el de nombres, para que
 * no lo recorte el panel con scroll donde está el formulario.
 */
export default function ProductoInput({
  productos = [],
  stock = {},
  value,
  onChange,
  onEnter,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  // Texto tipeado mientras se busca. En null el campo muestra el producto
  // elegido: recién al empezar a escribir pasa a ser una búsqueda.
  const [query, setQuery] = useState(null)
  const [hi, setHi] = useState(-1)
  const [pos, setPos] = useState(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const blurTimer = useRef(null)

  const producto = productos.find((p) => p.id === value)

  const ordenados = useMemo(
    () => [...productos].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    [productos],
  )

  const filtrados = useMemo(() => {
    const q = normalizeNombre(query || '')
    // Sin búsqueda se ve la lista entera: el campo también sirve de menú.
    if (!q) return ordenados
    // Cada palabra tipeada tiene que estar en el nombre, en cualquier orden:
    // "power rojo" encuentra "POWER GRANDE ROJO".
    const palabras = q.split(' ')
    return ordenados.filter((p) => {
      const n = normalizeNombre(p.nombre)
      return palabras.every((w) => n.includes(w))
    })
  }, [ordenados, query])

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

  // Con la lista completa abierta hay que arrastrar el resaltado a la vista,
  // si no las flechas parecen no hacer nada.
  useEffect(() => {
    if (!open || hi < 0) return
    listRef.current?.children[hi]?.scrollIntoView({ block: 'nearest' })
  }, [open, hi])

  const cerrar = () => {
    setOpen(false)
    setQuery(null)
    setHi(-1)
  }

  const elegir = (p) => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    onChange(p.id)
    cerrar()
  }

  const abrir = () => {
    setOpen(true)
    setHi(-1)
    place()
  }

  const handleKeyDown = (e) => {
    const visible = open && filtrados.length > 0
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        abrir()
        return
      }
      if (!filtrados.length) return
      const paso = e.key === 'ArrowDown' ? 1 : -1
      setHi((h) => (h + paso + filtrados.length) % filtrados.length)
      return
    }
    if (e.key === 'Escape') {
      cerrar()
      return
    }
    if (e.key === 'Enter') {
      // Con un solo resultado alcanza con tipear y dar Enter: no hace falta
      // bajar hasta él con las flechas.
      const elegido = visible && hi >= 0 ? filtrados[hi] : filtrados.length === 1 ? filtrados[0] : null
      if (elegido) {
        e.preventDefault()
        elegir(elegido)
        return
      }
      cerrar()
      onEnter && onEnter()
    }
  }

  return (
    <div className="producto-input">
      <input
        ref={inputRef}
        className={className}
        type="text"
        role="combobox"
        aria-expanded={open}
        placeholder="Buscar producto"
        autoComplete="off"
        value={query ?? producto?.nombre ?? ''}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHi(-1)
        }}
        onFocus={(e) => {
          abrir()
          // Seleccionar lo que hay deja escribir el producto nuevo encima sin
          // tener que borrar el anterior.
          e.target.select()
        }}
        onMouseDown={() => {
          // Un segundo clic con el campo ya enfocado cierra el menú, como el
          // desplegable de antes.
          if (open) setTimeout(cerrar, 0)
        }}
        onBlur={() => {
          // Al salir sin elegir, el campo vuelve a mostrar el producto que
          // estaba seleccionado: no se queda una búsqueda a medias.
          blurTimer.current = setTimeout(cerrar, 120)
        }}
        onKeyDown={handleKeyDown}
      />
      {open && pos &&
        createPortal(
          <ul
            ref={listRef}
            className="producto-sug"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtrados.length === 0 ? (
              <li className="producto-sug__vacio muted">Ningún producto coincide</li>
            ) : (
              filtrados.map((p, i) => {
                // De los productos con stock cargado se ve cuánto queda; los que
                // no se controlan (alquiler de paletas y demás) van sin nada.
                const queda = cantidadDe(stock, p.id)
                return (
                  <li
                    key={p.id}
                    className={`producto-sug__item ${i === hi ? 'is-active' : ''} ${
                      p.id === value ? 'is-selected' : ''
                    }`}
                    onMouseDown={() => elegir(p)}
                  >
                    <span className="producto-sug__nombre">{p.nombre}</span>
                    <span className="producto-sug__meta">
                      {formatMoney(p.precio)}
                      {queda === null ? '' : queda > 0 ? ` · quedan ${queda}` : ' · sin stock'}
                    </span>
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )}
    </div>
  )
}
