import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok, err } from '@/lib/utils'

const CreateMessageSchema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().optional().default(false),
  attachments: z.array(z.string()).optional().default([]),
})

// POST /api/tickets/[ticketId]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = CreateMessageSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { body: msgBody, isInternal, attachments } = parsed.data

  // Fetch ticket and check access
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: {
      id: true,
      clubId: true,
      creatorId: true,
      status: true,
      assignedToId: true,
      code: true,
    },
  })
  if (!ticket) return err('Ticket no encontrado', 404)

  // Determine effective admin status (SUPER_ADMIN or CLUB_ADMIN in ticket's club)
  let isAdmin = auth.platformRole === 'SUPER_ADMIN'
  if (!isAdmin) {
    const adminClubs = await prisma.clubMembership.findMany({
      where: { userId: auth.userId, clubRole: 'ADMIN', status: 'APPROVED' },
      select: { clubId: true },
    })
    const clubIds = adminClubs.map((m) => m.clubId)
    isAdmin = (!!ticket.clubId && clubIds.includes(ticket.clubId)) || ticket.creatorId === auth.userId
    if (isAdmin && ticket.clubId && !clubIds.includes(ticket.clubId) && ticket.creatorId !== auth.userId) {
      isAdmin = false
    }
  }

  // isInternal only for admins
  if (isInternal && !isAdmin) {
    return err('No tienes permiso para crear notas internas', 403)
  }

  // Access check — non-admin can only reply to their own tickets
  if (!isAdmin && ticket.creatorId !== auth.userId) {
    return err('Acceso denegado', 403)
  }

  // Determine new ticket status
  let newStatus = ticket.status
  if (isAdmin) {
    // Admin reply → WAITING (waiting for user)
    if (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') {
      newStatus = 'WAITING'
    }
  } else {
    // User reply → IN_PROGRESS if was OPEN or WAITING
    if (ticket.status === 'OPEN' || ticket.status === 'WAITING') {
      newStatus = 'IN_PROGRESS'
    }
  }

  const [message] = await Promise.all([
    prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: auth.userId,
        body: msgBody,
        attachments: attachments ?? [],
        isInternal: isInternal ?? false,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    newStatus !== ticket.status
      ? prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: newStatus },
        })
      : Promise.resolve(),
  ])

  // Notifications
  if (isAdmin && ticket.clubId) {
    // Admin replied → notify creator
    await prisma.notification.create({
      data: {
        userId: ticket.creatorId,
        clubId: ticket.clubId,
        title: 'Respuesta en tu ticket',
        message: `Han respondido a tu ticket ${ticket.code}`,
        link: `/socio/support?ticket=${ticket.id}`,
      },
    }).catch(() => null)
  } else if (!isAdmin) {
    // User replied → notify assignedTo or club admins
    if (ticket.assignedToId) {
      // Find any club this user belongs to for notification (use ticket.clubId or fallback)
      const clubIdForNotif = ticket.clubId
      if (clubIdForNotif) {
        await prisma.notification.create({
          data: {
            userId: ticket.assignedToId,
            clubId: clubIdForNotif,
            title: 'Nueva respuesta en ticket',
            message: `Hay una nueva respuesta en el ticket ${ticket.code}`,
            link: `/superadmin/tickets?ticket=${ticket.id}`,
          },
        }).catch(() => null)
      }
    } else if (ticket.clubId) {
      const admins = await prisma.clubMembership.findMany({
        where: { clubId: ticket.clubId, clubRole: 'ADMIN', status: 'APPROVED' },
        select: { userId: true },
      })
      await Promise.all(
        admins.map((a) =>
          prisma.notification.create({
            data: {
              userId: a.userId,
              clubId: ticket.clubId!,
              title: 'Nueva respuesta en ticket',
              message: `Hay una nueva respuesta en el ticket ${ticket.code}`,
              link: `/admin/support?ticket=${ticket.id}`,
            },
          }).catch(() => null)
        )
      )
    }
  }

  return ok(message, 201)
}
