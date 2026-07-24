import { createContext, useContext, createElement } from 'react'

// Club activo de la sesión. Lo consumen los modales (resumen, saldos) para no
// tener que arrastrar el clubId por props a través de media app.
const ClubContext = createContext(null)

export function ClubProvider({ value, children }) {
  return createElement(ClubContext.Provider, { value }, children)
}

export function useClubId() {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClubId debe usarse dentro de <ClubProvider>')
  return ctx.clubId
}

export function useClub() {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub debe usarse dentro de <ClubProvider>')
  return ctx
}
