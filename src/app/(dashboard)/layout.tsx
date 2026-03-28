import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getThemeVars } from '@/lib/themes'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardProvider } from '@/providers/DashboardProvider'
import type { DashboardContextValue } from '@/providers/DashboardProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id
  const role = (session.user as { role: string }).role as 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'

  let club = null
  let membershipRole: 'CLUB_ADMIN' | 'SOCIO' | null = null
  let membershipId = ''

  if (role !== 'SUPER_ADMIN') {
    // Cookie set by ClubSwitcher when user changes active club
    const cookieStore = cookies()
    const activeClubId = cookieStore.get('activeClubId')?.value ?? null

    // Try the preferred club first
    let membership = activeClubId
      ? await prisma.clubMembership.findFirst({
          where: { userId, clubId: activeClubId, status: 'APPROVED' },
          include: { club: true },
        })
      : null

    // Fallback: first club by join date (cookie invalid / no cookie)
    if (!membership) {
      membership = await prisma.clubMembership.findFirst({
        where: { userId, status: 'APPROVED' },
        orderBy: { joinedAt: 'asc' },
        include: { club: true },
      })
    }

    if (membership) {
      club = membership.club
      membershipRole = membership.role as 'CLUB_ADMIN' | 'SOCIO'
      membershipId = membership.id
    }
  }

  const headersList = headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''
  const isInSocioView = pathname.startsWith('/socio')
  const isAdminViewingAsSocio = membershipRole === 'CLUB_ADMIN' && isInSocioView

  const sidebarRole = role === 'SUPER_ADMIN'
    ? 'SUPER_ADMIN'
    : isAdminViewingAsSocio
      ? 'SOCIO'
      : (membershipRole ?? 'SOCIO')

  const mode: DashboardContextValue['mode'] = role === 'SUPER_ADMIN'
    ? 'superadmin'
    : isInSocioView
      ? 'socio'
      : 'admin'

  const contextValue: DashboardContextValue = {
    clubId: club?.id ?? '',
    clubName: club?.name ?? '',
    clubLogo: club?.logoUrl ?? null,
    colorTheme: club?.colorTheme ?? null,
    membershipId,
    role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (membershipRole ?? 'SOCIO'),
    mode,
    isAdminViewingAsSocio,
  }

  const themeVars = getThemeVars(club?.colorTheme ?? 'blue')

  return (
    <DashboardProvider value={contextValue}>
      <div className="flex h-screen overflow-hidden" style={{ cssText: themeVars } as React.CSSProperties}>
        <Sidebar
          role={sidebarRole}
          clubName={club?.name}
          clubLogo={club?.logoUrl}
          colorTheme={club?.colorTheme}
          isAdminViewingAsSocio={isAdminViewingAsSocio}
          mode={mode}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardProvider>
  )
}
