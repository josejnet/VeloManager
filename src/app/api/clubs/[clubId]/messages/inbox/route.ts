import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/clubs/[clubId]/messages/inbox — socio inbox
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)

  const where = { userId: access.userId, message: { clubId: params.clubId } }

  const [items, total, unreadCount] = await Promise.all([
    prisma.clubMessageRecipient.findMany({
      where,
      skip, take,
      orderBy: { message: { sentAt: 'desc' } },
      include: {
        message: {
          include: { sender: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.clubMessageRecipient.count({ where }),
    prisma.clubMessageRecipient.count({ where: { userId: access.userId, read: false, message: { clubId: params.clubId } } }),
  ])

  return ok({ ...buildPaginatedResponse(items, total, page, pageSize), unreadCount })
}

// PATCH /api/clubs/[clubId]/messages/inbox — mark as read
export async function PATCH(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  const where = body.messageId
    ? { userId: access.userId, messageId: body.messageId as string }
    : { userId: access.userId, message: { clubId: params.clubId }, read: false }

  await prisma.clubMessageRecipient.updateMany({
    where,
    data: { read: true, readAt: new Date() },
  })

  return ok({ success: true })
}
