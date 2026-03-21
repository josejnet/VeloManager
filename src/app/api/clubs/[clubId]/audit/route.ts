import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/clubs/[clubId]/audit
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const entity = req.nextUrl.searchParams.get('entity')
  const userId = req.nextUrl.searchParams.get('userId')

  const where = {
    clubId: params.clubId,
    ...(entity ? { entity } : {}),
    ...(userId ? { userId } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return ok(buildPaginatedResponse(logs, total, page, pageSize))
}
