import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/notifications — list user's own notifications
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true'

  // Read activeClubId from cookie header
  const cookieHeader = req.headers.get('cookie') ?? ''
  const activeClubIdMatch = cookieHeader.match(/activeClubId=([^;]+)/)
  const activeClubId = activeClubIdMatch ? decodeURIComponent(activeClubIdMatch[1]) : null

  const where: {
    userId: string
    read?: boolean
    clubId?: string | null
  } = {
    userId: auth.userId,
    ...(unreadOnly ? { read: false } : {}),
    ...(activeClubId ? { clubId: activeClubId } : {}),
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

  return ok({
    ...buildPaginatedResponse(notifications, total, page, pageSize),
    unreadCount,
  })
}
