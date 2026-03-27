'use client'
/**
 * ClubContext — passes club data from the Server Component layout to all
 * client pages synchronously, eliminating the /api/clubs waterfall.
 *
 * USAGE (client component inside dashboard layout):
 *   const { clubId, club } = useClub()          // throws if no Provider
 *   const ctx = useClubOptional()                // null for SUPER_ADMIN pages
 */

import { createContext, useContext } from 'react'

export interface ClubData {
  id: string
  name: string
  slogan: string | null
  sport: string
  logoUrl: string | null
  colorTheme: string
  primaryColor: string | null
  secondaryColor: string | null
}

interface ClubContextValue {
  clubId: string
  club: ClubData
}

const ClubContext = createContext<ClubContextValue | null>(null)

export function ClubProvider({
  clubId,
  club,
  children,
}: {
  clubId: string
  club: ClubData
  children: React.ReactNode
}) {
  return (
    <ClubContext.Provider value={{ clubId, club }}>
      {children}
    </ClubContext.Provider>
  )
}

/** Use inside pages that are always within a club context (admin/socio). Throws if no Provider. */
export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub must be used inside ClubProvider (dashboard layout)')
  return ctx
}

/** Use where the provider may be absent (Header, shared components, SUPER_ADMIN pages). */
export function useClubOptional(): ClubContextValue | null {
  return useContext(ClubContext)
}
