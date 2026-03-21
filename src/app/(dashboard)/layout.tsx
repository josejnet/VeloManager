import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getThemeVars } from '@/lib/themes'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id
  const role = (session.user as { role: string }).role as 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'

  let club = null
  let membershipRole: 'CLUB_ADMIN' | 'SOCIO' | null = null

  if (role !== 'SUPER_ADMIN') {
    const membership = await prisma.clubMembership.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { joinedAt: 'asc' },
      include: { club: true },
    })
    if (membership) {
      club = membership.club
      membershipRole = membership.role as 'CLUB_ADMIN' | 'SOCIO'
    }
  }

  // Determine view mode: a CLUB_ADMIN viewing /socio/* sees socio nav + admin shortcut
  const headersList = headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''
  const isInSocioView = pathname.startsWith('/socio')
  const isAdminViewingAsSocio = membershipRole === 'CLUB_ADMIN' && isInSocioView

  // Effective sidebar role
  const sidebarRole = role === 'SUPER_ADMIN'
    ? 'SUPER_ADMIN'
    : isAdminViewingAsSocio
      ? 'SOCIO'
      : (membershipRole ?? 'SOCIO')

  const themeVars = getThemeVars(club?.colorTheme ?? 'blue')

  return (
    <div className="flex h-screen overflow-hidden" style={{ cssText: themeVars } as React.CSSProperties}>
      <Sidebar
        role={sidebarRole}
        clubName={club?.name}
        clubLogo={club?.logoUrl}
        colorTheme={club?.colorTheme}
        isAdminViewingAsSocio={isAdminViewingAsSocio}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
