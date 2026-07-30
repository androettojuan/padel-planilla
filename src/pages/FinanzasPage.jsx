import { useState } from 'react'
import Pantalla from '../components/Pantalla'
import ResumenMensualPage from './ResumenMensualPage'
import SaldosPage from './SaldosPage'

/**
 * La plata del club en un solo lugar: lo facturado en el mes y lo que queda por
 * cobrar. Son dos vistas de lo mismo, así que comparten sección y se alternan
 * con las solapas de arriba en vez de estar en dos botones separados.
 */
export default function FinanzasPage({ monthKey, jugadores, sugerencias, onCommitNombre }) {
  const [vista, setVista] = useState('mes')

  return (
    <Pantalla
      titulo="Finanzas"
      descripcion="Lo facturado en el mes y las cuentas que quedan por cobrar."
      acciones={
        <div className="subnav">
          <button
            className={`subnav__tab ${vista === 'mes' ? 'is-active' : ''}`}
            onClick={() => setVista('mes')}
          >
            Resumen del mes
          </button>
          <button
            className={`subnav__tab ${vista === 'fiados' ? 'is-active' : ''}`}
            onClick={() => setVista('fiados')}
          >
            Fiados
          </button>
        </div>
      }
    >
      {vista === 'mes' ? (
        <ResumenMensualPage monthKey={monthKey} />
      ) : (
        <SaldosPage
          jugadores={jugadores}
          sugerencias={sugerencias}
          onCommitNombre={onCommitNombre}
        />
      )}
    </Pantalla>
  )
}
