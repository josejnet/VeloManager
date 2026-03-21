import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/clubs/public — public club directory for join page
export async function GET(req: NextRequest) {
  const { skip, take, page, pageSize } = getPaginationParams(req.nextUrl.searchParams)
  const search = req.nextUrl.searchParams.get('search')

  const where = {
    active: true,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [clubs, total] = await Promise.all([
    prisma.club.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slogan: true,
        sport: true,
        colorTheme: true,
        logoUrl: true,
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
      },
    }),
    prisma.club.count({ where }),
  ])

  return ok(buildPaginatedResponse(clubs, total, page, pageSize))
}
