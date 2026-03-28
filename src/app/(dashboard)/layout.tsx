import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getThemeVars, themeVarsToStyle } from '@/lib/themes'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardProvider } from '@/providers/DashboardProvider'
import type { DashboardContextValue } from '@/providers/DashboardProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  // Always query DB for platformRole — never trust stale JWT
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } })
  const platformRole = dbUser?.platformRole ?? 'USER'
  const isSuperAdmin = platformRole === 'SUPER_ADMIN'

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''

  let club = null
  let membershipRole: 'ADMIN' | 'MEMBER' | null = null
  let membershipId = ''

  if (!isSuperAdmin) {
    const cookieStore = await cookies()
    const activeClubId = cookieStore.get('activeClubId')?.value ?? null

    let membership = activeClubId
      ? await prisma.clubMembership.findFirst({
          where: { userId, clubId: activeClubId, status: 'APPROVED' },
          include: { club: true },
        })
      : null

    if (!membership) {
      membership = await prisma.clubMembership.findFirst({
        where: { userId, status: 'APPROVED' },
        orderBy: { joinedAt: 'asc' },
        include: { club: true },
      })
    }

    if (membership) {
      club = membership.club
      membershipRole = membership.clubRole as 'ADMIN' | 'MEMBER'
      membershipId = membership.id

      // Phase 4: Redirect /admin/* and /socio/* to the new URL-based structure
      if (pathname.startsWith('/admin') || pathname.startsWith('/socio')) {
        const section = pathname.startsWith('/socio') ? 'socio' : 'admin'
        const subpath = pathname.startsWith('/socio')
          ? pathname.slice('/socio'.length)
          : pathname.slice('/admin'.length)
        redirect(`/clubs/${membership.clubId}/${section}${subpath}`)
      }
    } else if (pathname.startsWith('/admin')) {
      // Non-member trying to access admin — redirect to socio landing
      redirect('/socio')
    }
  }

  const isInSocioView = pathname.startsWith('/socio')
  const isAdminViewingAsSocio = membershipRole === 'ADMIN' && isInSocioView

  const sidebarRole = isSuperAdmin
    ? 'SUPER_ADMIN'
    : isAdminViewingAsSocio
      ? 'MEMBER'
      : (membershipRole ?? 'MEMBER')

  const mode: DashboardContextValue['mode'] = isSuperAdmin
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
    role: isSuperAdmin ? 'SUPER_ADMIN' : (membershipRole ?? 'MEMBER'),
    mode,
    isAdminViewingAsSocio,
  }

  const themeVars = getThemeVars(club?.colorTheme ?? 'blue')

  return (
    <DashboardProvider value={contextValue}>
      <div className="flex h-screen overflow-hidden" style={themeVarsToStyle(themeVars)}>
        <Sidebar
          role={sidebarRole}
          clubName={club?.name}
          clubLogo={club?.logoUrl}
          colorTheme={club?.colorTheme}
          isAdminViewingAsSocio={isAdminViewingAsSocio}
          mode={mode}
          baseHref=""
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardProvider>
  )
}
