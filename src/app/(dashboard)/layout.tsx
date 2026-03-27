import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getThemeVars } from '@/lib/themes'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmergencyAnnouncementModal } from '@/components/announcements/EmergencyAnnouncementModal'
import { ClubProvider } from '@/context/ClubContext'
import { SWRConfigProvider } from '@/components/providers/SWRConfigProvider'

const getMembership = unstable_cache(
  async (userId: string) =>
    prisma.clubMembership.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        club: {
          select: {
            id: true,
            name: true,
            slogan: true,
            sport: true,
            logoUrl: true,
            colorTheme: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    }),
  ['layout-membership'],
  { revalidate: 300, tags: ['layout-membership'] },
)

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id
  const role = (session.user as { role: string }).role as 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'

  let club = null
  let membershipRole: 'CLUB_ADMIN' | 'SOCIO' | null = null

  if (role !== 'SUPER_ADMIN') {
    const membership = await getMembership(userId)
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

  // ── Branding: custom hex colors override the predefined theme palette ──────
  const themeVars = getThemeVars(
    club?.colorTheme ?? 'blue',
    club?.primaryColor,
    club?.secondaryColor,
  )

  // Show the emergency modal whenever the user is in a club context
  const showAnnouncementModal = !!club && role !== 'SUPER_ADMIN'

  return (
    <SWRConfigProvider>
      <div className="flex h-screen overflow-hidden" style={{ cssText: themeVars } as React.CSSProperties}>
        <Sidebar
          role={sidebarRole}
          clubName={club?.name}
          clubLogo={club?.logoUrl}
          colorTheme={club?.colorTheme}
          isAdminViewingAsSocio={isAdminViewingAsSocio}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {club ? (
            <ClubProvider clubId={club.id} club={club}>
              {children}
            </ClubProvider>
          ) : (
            children
          )}
        </div>

        {/* Emergency/pending announcement modal — client component, polls independently */}
        {showAnnouncementModal && <EmergencyAnnouncementModal clubId={club!.id} />}
      </div>
    </SWRConfigProvider>
  )
}
