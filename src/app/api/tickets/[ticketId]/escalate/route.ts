import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { writeAudit } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

// POST /api/tickets/[ticketId]/escalate
export async function POST(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  // SUPER_ADMIN cannot escalate (they are the escalation target)
  if (auth.platformRole === 'SUPER_ADMIN') {
    return err('Los super administradores no pueden escalar tickets', 403)
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: {
      id: true,
      clubId: true,
      creatorId: true,
      escalatedAt: true,
      code: true,
      subject: true,
    },
  })
  if (!ticket) return err('Ticket no encontrado', 404)

  // Verify admin belongs to this ticket's club
  if (ticket.clubId) {
    const membership = await prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId: auth.userId, clubId: ticket.clubId } },
      select: { role: true, status: true },
    })
    if (!membership || membership.status !== 'APPROVED' || membership.role !== 'CLUB_ADMIN') {
      return err('Acceso denegado', 403)
    }
  } else if (ticket.creatorId !== auth.userId) {
    return err('Acceso denegado', 403)
  }

  if (ticket.escalatedAt) {
    return err('Este ticket ya ha sido escalado', 400)
  }

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      escalatedAt: new Date(),
      escalatedById: auth.userId,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
    },
    include: {
      creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
      club: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  // Notify all SUPER_ADMINs
  const superAdmins = await prisma.user.findMany({
    where: { platformRole: 'SUPER_ADMIN' },
    select: { id: true },
  })

  const clubIdForNotif = ticket.clubId
  if (clubIdForNotif) {
    await Promise.all(
      superAdmins.map((sa) =>
        prisma.notification.create({
          data: {
            userId: sa.id,
            clubId: clubIdForNotif,
            title: 'Ticket escalado',
            message: `El ticket ${ticket.code} ha sido escalado a soporte global`,
            link: `/superadmin/tickets?ticket=${ticket.id}`,
          },
        }).catch(() => null)
      )
    )
  }

  await writeAudit({
    clubId: ticket.clubId ?? '',
    userId: auth.userId,
    action: 'TICKET_ESCALATED',
    entity: 'Ticket',
    entityId: ticket.id,
    details: { code: ticket.code, subject: ticket.subject },
  })

  return ok(updated)
}
