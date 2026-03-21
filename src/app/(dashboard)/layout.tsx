import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
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
  let effectiveRole = role

  if (role !== 'SUPER_ADMIN') {
    // Get user's primary club (first approved membership)
    const membership = await prisma.clubMembership.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { joinedAt: 'asc' },
      include: { club: true },
    })
    if (membership) {
      club = membership.club
      effectiveRole = membership.role
    }
  }

  const themeVars = getThemeVars(club?.colorTheme ?? 'blue')

  return (
    <div className="flex h-screen overflow-hidden" style={{ cssText: themeVars } as React.CSSProperties}>
      <Sidebar
        role={effectiveRole}
        clubName={club?.name}
        clubLogo={club?.logoUrl}
        colorTheme={club?.colorTheme}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
