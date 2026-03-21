import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/club-access'
import { ok, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/notifications
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true'
  const clubId = req.nextUrl.searchParams.get('clubId')

  const where = {
    userId: auth.userId,
    ...(unreadOnly ? { read: false } : {}),
    ...(clubId ? { clubId } : {}),
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: auth.userId, read: false } }),
  ])

  return ok({ ...buildPaginatedResponse(notifications, total, page, pageSize), unreadCount })
}

// PATCH /api/notifications — mark all as read
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const where = body.id
    ? { id: body.id as string, userId: auth.userId }
    : { userId: auth.userId, read: false }

  await prisma.notification.updateMany({ where, data: { read: true } })

  return ok({ success: true })
}
