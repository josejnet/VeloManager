'use client'
import { createContext, useContext } from 'react'

export interface DashboardContextValue {
  clubId: string
  clubName: string
  clubLogo: string | null
  colorTheme: string | null
  membershipId: string
  role: 'CLUB_ADMIN' | 'SOCIO' | 'SUPER_ADMIN'
  /** Current UI mode based on route prefix */
  mode: 'admin' | 'socio' | 'superadmin'
  /** True when a CLUB_ADMIN is browsing /socio/* */
  isAdminViewingAsSocio: boolean
}

const DashboardContext = createContext<DashboardContextValue>({
  clubId: '',
  clubName: '',
  clubLogo: null,
  colorTheme: null,
  membershipId: '',
  role: 'SOCIO',
  mode: 'socio',
  isAdminViewingAsSocio: false,
})

export function DashboardProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: DashboardContextValue
}) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export const useDashboard = () => useContext(DashboardContext)
