import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/superadmin/clubs — full platform metrics
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const search = req.nextUrl.searchParams.get('search')

  const where = search
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {}

  const [clubs, total, globalStats] = await Promise.all([
    prisma.club.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        bankAccount: true,
        _count: {
          select: {
            memberships: { where: { status: 'APPROVED' } },
            products: true,
            votes: true,
          },
        },
      },
    }),
    prisma.club.count({ where }),
    prisma.$transaction([
      prisma.club.count(),
      prisma.user.count(),
      prisma.clubMembership.count({ where: { status: 'APPROVED' } }),
      prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
    ]),
  ])

  const [totalClubs, totalUsers, totalMembers, totalOrders] = globalStats

  return ok({
    ...buildPaginatedResponse(clubs, total, page, pageSize),
    globalStats: { totalClubs, totalUsers, totalMembers, totalOrders },
  })
}
