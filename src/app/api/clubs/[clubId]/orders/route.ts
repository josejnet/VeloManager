import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/clubs/[clubId]/orders
// CLUB_ADMIN: all orders across all campaigns, filterable by status/windowId
// SOCIO: only their own orders
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const windowId = req.nextUrl.searchParams.get('windowId') ?? undefined

  const isAdmin = access.clubRole === 'ADMIN' || access.platformRole === 'SUPER_ADMIN'

  const where = {
    clubId: params.clubId,
    ...(isAdmin ? {} : { userId: access.userId }),
    ...(status ? { status: status as never } : {}),
    ...(windowId ? { purchaseWindowId: windowId } : {}),
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        purchaseWindow: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, images: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ])

  return ok(buildPaginatedResponse(orders, total, page, pageSize))
}
