import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/club-access'
import { writeAudit } from '@/lib/audit'
import { ok, err } from '@/lib/utils'
import type { TicketStatus, TicketPriority } from '@prisma/client'

const ticketDetailIncludes = {
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  club: {
    select: {
      id: true,
      name: true,
      subscription: { select: { plan: true } },
    },
  },
  assignedTo: { select: { id: true, name: true } },
  escalatedBy: { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
} as const

const PatchTicketSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_status'),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const),
  }),
  z.object({
    action: z.literal('assign'),
    assignedToId: z.string(),
  }),
  z.object({
    action: z.literal('update_priority'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const),
  }),
])

async function getTicketWithAccess(ticketId: string, userId: string, role: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketDetailIncludes,
  })

  if (!ticket) return { ticket: null, forbidden: false }

  if (role === 'SUPER_ADMIN') return { ticket, forbidden: false }

  if (role === 'CLUB_ADMIN') {
    // Club admin sees tickets of their clubs
    const adminClubs = await prisma.clubMembership.findMany({
      where: { userId, role: 'CLUB_ADMIN', status: 'APPROVED' },
      select: { clubId: true },
    })
    const clubIds = adminClubs.map((m) => m.clubId)
    if (ticket.clubId && clubIds.includes(ticket.clubId)) {
      return { ticket, forbidden: false }
    }
    // Also show tickets created by this admin (club→superadmin tickets)
    if (ticket.creatorId === userId) return { ticket, forbidden: false }
    return { ticket: null, forbidden: true }
  }

  // SOCIO
  if (ticket.creatorId !== userId) return { ticket: null, forbidden: true }
  return { ticket, forbidden: false }
}

// GET /api/tickets/[ticketId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { ticket, forbidden } = await getTicketWithAccess(params.ticketId, auth.userId, auth.role)

  if (forbidden) return err('Acceso denegado', 403)
  if (!ticket) return err('Ticket no encontrado', 404)

  return ok(ticket)
}

// PATCH /api/tickets/[ticketId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = PatchTicketSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { action } = parsed.data

  // Access control per action
  if (action === 'assign' || action === 'update_priority') {
    if (auth.role !== 'SUPER_ADMIN') return err('Acceso denegado', 403)
  } else if (action === 'update_status') {
    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'CLUB_ADMIN') {
      return err('Acceso denegado', 403)
    }
  }

  // Verify ticket access
  const existing = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: { id: true, clubId: true, creatorId: true, code: true },
  })
  if (!existing) return err('Ticket no encontrado', 404)

  if (auth.role === 'CLUB_ADMIN' && action === 'update_status') {
    const adminClubs = await prisma.clubMembership.findMany({
      where: { userId: auth.userId, role: 'CLUB_ADMIN', status: 'APPROVED' },
      select: { clubId: true },
    })
    const clubIds = adminClubs.map((m) => m.clubId)
    const owns =
      (existing.clubId && clubIds.includes(existing.clubId)) ||
      existing.creatorId === auth.userId
    if (!owns) return err('Acceso denegado', 403)
  }

  let updateData: { status?: TicketStatus; assignedToId?: string; priority?: TicketPriority } = {}

  if (action === 'update_status') {
    updateData.status = parsed.data.status
  } else if (action === 'assign') {
    // Verify assignee is a super admin
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId },
      select: { role: true },
    })
    if (!assignee || assignee.role !== 'SUPER_ADMIN') {
      return err('Solo puedes asignar tickets a super administradores', 400)
    }
    updateData.assignedToId = parsed.data.assignedToId
  } else if (action === 'update_priority') {
    updateData.priority = parsed.data.priority
  }

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: updateData,
    include: ticketDetailIncludes,
  })

  await writeAudit({
    clubId: existing.clubId ?? '',
    userId: auth.userId,
    action: `TICKET_${action.toUpperCase()}`,
    entity: 'Ticket',
    entityId: existing.id,
    details: { ...updateData, code: existing.code },
  })

  return ok(updated)
}
