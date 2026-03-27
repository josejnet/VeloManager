'use client'
/**
 * ClubContext — eliminates the /api/clubs waterfall from every client page.
 *
 * WHY THIS EXISTS:
 *   Every client page was doing:
 *     1. mount → render "Cargando..."
 *     2. fetch('/api/clubs?pageSize=1')      ← round trip 1
 *     3. setClubId() → fetch actual data    ← round trip 2
 *     4. render content
 *
 *   The dashboard layout (server component) already queries the club from the
 *   database. We just pass that data down through this context so client pages
 *   can skip step 2 entirely, reducing cold-nav latency by one full RTT.
 *
 * USAGE (client component):
 *   const { clubId, club } = useClub()
 */

import { createContext, useContext } from 'react'

interface ClubData {
  id: string
  name: string
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

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub must be used inside ClubProvider (dashboard layout)')
  return ctx
}
