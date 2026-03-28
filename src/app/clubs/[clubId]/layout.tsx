import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getThemeVars, themeVarsToStyle } from '@/lib/themes'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardProvider } from '@/providers/DashboardProvider'
import type { DashboardContextValue } from '@/providers/DashboardProvider'
import { ClubProvider } from '@/context/ClubContext'
import type { ClubData } from '@/context/ClubContext'

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

  let club = null
  let membershipRole: 'ADMIN' | 'MEMBER' | null = null
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
    membershipRole = membership.clubRole as 'ADMIN' | 'MEMBER'
    membershipId = membership.id
  } else {
    // Super admin: load any club data for display
    club = await prisma.club.findUnique({
      where: { id: clubId },
    })
  }

  // El sidebar es único y dinámico — el rol real controla qué secciones ve
  const sidebarRole = platformRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (membershipRole ?? 'MEMBER')

  const mode: DashboardContextValue['mode'] = platformRole === 'SUPER_ADMIN'
    ? 'superadmin'
    : membershipRole === 'ADMIN'
      ? 'admin'
      : 'socio'

  const contextValue: DashboardContextValue = {
    clubId: club?.id ?? clubId,
    clubName: club?.name ?? '',
    clubLogo: club?.logoUrl ?? null,
    colorTheme: club?.colorTheme ?? null,
    membershipId,
    role: platformRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (membershipRole ?? 'MEMBER'),
    mode,
    isAdminViewingAsSocio: false,
  }

  // The base path for nav links in this route group (eliminates cookie dependency)
  const baseHref = `/clubs/${clubId}`
  const themeVars = getThemeVars(club?.colorTheme ?? 'blue')

  const clubData: ClubData | null = club ? {
    id: club.id,
    name: club.name,
    slogan: club.slogan ?? null,
    sport: club.sport,
    logoUrl: club.logoUrl ?? null,
    colorTheme: club.colorTheme,
    primaryColor: (club as any).primaryColor ?? null,
    secondaryColor: (club as any).secondaryColor ?? null,
  } : null

  const layout = (
    <DashboardProvider value={contextValue}>
      <div className="flex h-screen overflow-hidden" style={themeVarsToStyle(themeVars)}>
        <Sidebar
          role={sidebarRole}
          clubName={club?.name}
          clubLogo={club?.logoUrl}
          colorTheme={club?.colorTheme ?? undefined}
          mode={mode}
          baseHref={baseHref}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardProvider>
  )

  return clubData ? (
    <ClubProvider clubId={clubData.id} club={clubData}>
      {layout}
    </ClubProvider>
  ) : layout
}
