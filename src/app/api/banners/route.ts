import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok } from '@/lib/utils'

/**
 * GET /api/banners
 * Returns platform banners that match the current user's context.
 * Called on every dashboard load to inject the relevant banner(s).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const clubId = req.nextUrl.searchParams.get('clubId')
  const now = new Date()

  // Build user context for filtering
  const [user, clubMembership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { province: true, locality: true },
    }),
    clubId
      ? prisma.clubMembership.findFirst({
          where: { userId: auth.userId, clubId, status: 'APPROVED' },
          select: { role: true },
        })
      : null,
  ])

  // Effective role for banner targeting (uses legacy UserRole from ClubMembership)
  const effectiveRole = auth.platformRole === 'SUPER_ADMIN'
    ? 'SUPER_ADMIN'
    : clubMembership?.role ?? 'SOCIO'

  let club = null
  if (clubId) {
    club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { sport: true, province: true, locality: true },
    })
  }

  // Fetch all active, non-expired banners and filter in-memory (simple for 100 clubs scale)
  const allBanners = await prisma.platformBanner.findMany({
    where: {
      active: true,
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishAt: 'desc' },
  })

  const matched = allBanners.filter((b) => {
    // Role filter (targetRoles stores UserRole values)
    if (b.targetRoles.length > 0 && !b.targetRoles.includes(effectiveRole as never)) return false

    switch (b.targetType) {
      case 'ALL': return true
      case 'CLUB': return clubId ? b.targetClubIds.includes(clubId) : false
      case 'SPORT': return club ? b.targetSport === club.sport : false
      case 'PROVINCE':
        return (club?.province && b.targetProvince === club.province) ||
               (user?.province && b.targetProvince === user.province)
      case 'LOCALITY':
        return (club?.locality && b.targetLocality === club.locality) ||
               (user?.locality && b.targetLocality === user.locality)
      default: return false
    }
  })

  return ok(matched.slice(0, 3)) // max 3 banners per page load
}
