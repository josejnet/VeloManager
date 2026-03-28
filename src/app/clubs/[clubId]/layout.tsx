import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getThemeVars } from '@/lib/themes'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardProvider } from '@/providers/DashboardProvider'
import type { DashboardContextValue } from '@/providers/DashboardProvider'

interface ClubLayoutProps {
  children: React.ReactNode
  params: Promise<{ clubId: string }>
}

export default async function ClubLayout({ children, params }: ClubLayoutProps) {
  const { clubId } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  // Always query DB for platform role — never trust JWT
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } })
  const platformRole = dbUser?.platformRole ?? 'USER'

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''

  let club = null
  let membershipRole: 'CLUB_ADMIN' | 'SOCIO' | null = null
  let membershipId = ''

  if (platformRole !== 'SUPER_ADMIN') {
    const membership = await prisma.clubMembership.findFirst({
      where: { userId, clubId, status: 'APPROVED' },
      include: { club: true },
    })

    if (!membership) {
      // User is not a member of this club — redirect to their first available club
      const fallback = await prisma.clubMembership.findFirst({
        where: { userId, status: 'APPROVED' },
        orderBy: { joinedAt: 'asc' },
        select: { clubId: true },
      })
      if (fallback) {
        redirect(`/clubs/${fallback.clubId}/socio`)
      } else {
        redirect('/login')
      }
    }

    club = membership.club
    membershipRole = membership.role as 'CLUB_ADMIN' | 'SOCIO'
    membershipId = membership.id
  } else {
    // Super admin: load any club data for display
    club = await prisma.club.findUnique({
      where: { id: clubId },
    })
  }

  // Derive view mode from pathname
  const isInSocioView = pathname.includes('/socio')
  const isAdminViewingAsSocio = membershipRole === 'CLUB_ADMIN' && isInSocioView

  const sidebarRole = platformRole === 'SUPER_ADMIN'
    ? 'SUPER_ADMIN'
    : isAdminViewingAsSocio
      ? 'SOCIO'
      : (membershipRole ?? 'SOCIO')

  const mode: DashboardContextValue['mode'] = platformRole === 'SUPER_ADMIN'
    ? 'superadmin'
    : isInSocioView
      ? 'socio'
      : 'admin'

  const contextValue: DashboardContextValue = {
    clubId: club?.id ?? clubId,
    clubName: club?.name ?? '',
    clubLogo: club?.logoUrl ?? null,
    colorTheme: club?.colorTheme ?? null,
    membershipId,
    role: platformRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (membershipRole ?? 'SOCIO'),
    mode,
    isAdminViewingAsSocio,
  }

  // The base path for nav links in this route group (eliminates cookie dependency)
  const baseHref = `/clubs/${clubId}`
  const themeVars = getThemeVars(club?.colorTheme ?? 'blue')

  return (
    <DashboardProvider value={contextValue}>
      <div className="flex h-screen overflow-hidden" style={{ cssText: themeVars } as React.CSSProperties}>
        <Sidebar
          role={sidebarRole}
          clubName={club?.name}
          clubLogo={club?.logoUrl}
          colorTheme={club?.colorTheme ?? undefined}
          isAdminViewingAsSocio={isAdminViewingAsSocio}
          mode={mode}
          baseHref={baseHref}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardProvider>
  )
}
