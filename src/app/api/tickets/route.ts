import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/club-access'
import { writeAudit } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import type { TicketCategory, TicketPriority, SubscriptionPlan, Prisma } from '@prisma/client'

const ticketIncludes = {
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  club: {
    select: {
      id: true,
      name: true,
      subscription: { select: { plan: true } },
    },
  },
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} as const

function planToPriority(plan: SubscriptionPlan | null | undefined): TicketPriority {
  if (!plan) return 'LOW'
  const map: Record<SubscriptionPlan, TicketPriority> = {
    FREE: 'LOW',
    PRO: 'MEDIUM',
    PREMIUM: 'HIGH',
    ENTERPRISE: 'URGENT',
  }
  return map[plan]
}

const CreateTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  category: z.enum(['BILLING', 'TECHNICAL', 'REPORT', 'INQUIRY'] as const),
  clubId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// GET /api/tickets
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const category = req.nextUrl.searchParams.get('category') ?? undefined

  const statusFilter = status ? { status: status as TicketCategory } : {}
  const categoryFilter = category ? { category: category as TicketCategory } : {}

  let where: Record<string, unknown> = {}

  if (auth.role === 'SUPER_ADMIN') {
    where = { ...statusFilter, ...categoryFilter }
  } else if (auth.role === 'CLUB_ADMIN') {
    const activeClubId = req.headers.get('x-active-club-id') ?? req.cookies.get('activeClubId')?.value
    if (!activeClubId) return err('Club activo no encontrado', 400)
    where = { clubId: activeClubId, ...statusFilter, ...categoryFilter }
  } else {
    // SOCIO
    where = { creatorId: auth.userId, ...statusFilter, ...categoryFilter }
  }

  const orderBy =
    auth.role === 'SUPER_ADMIN'
      ? [{ priority: 'desc' as const }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }]

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({ where, skip, take, orderBy, include: ticketIncludes }),
    prisma.ticket.count({ where }),
  ])

  return ok(buildPaginatedResponse(tickets, total, page, pageSize))
}

// POST /api/tickets
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = CreateTicketSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { subject, description, category, clubId, metadata } = parsed.data

  // Verify club membership if clubId provided
  let priority: TicketPriority = 'LOW'
  if (clubId) {
    const membership = await prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId: auth.userId, clubId } },
      select: { status: true },
    })
    if (
      auth.role !== 'SUPER_ADMIN' &&
      (!membership || membership.status !== 'APPROVED')
    ) {
      return err('No tienes acceso a este club', 403)
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { subscription: { select: { plan: true } } },
    })
    priority = planToPriority(club?.subscription?.plan)
  }

  // Generate code
  const count = await prisma.ticket.count()
  const code = `TK-${String(count + 1).padStart(4, '0')}`

  // Create ticket + initial message in a transaction
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        code,
        subject,
        description,
        category,
        priority,
        status: 'OPEN',
        creatorId: auth.userId,
        clubId: clubId ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
      include: ticketIncludes,
    })

    await tx.ticketMessage.create({
      data: {
        ticketId: t.id,
        senderId: auth.userId,
        body: description,
        attachments: [],
        isInternal: false,
      },
    })

    return t
  })

  // Notifications
  if (auth.role === 'SOCIO' && clubId) {
    // Notify all CLUB_ADMINs of that club
    const admins = await prisma.clubMembership.findMany({
      where: { clubId, role: 'CLUB_ADMIN', status: 'APPROVED' },
      select: { userId: true },
    })
    await Promise.all(
      admins.map((a) =>
        prisma.notification.create({
          data: {
            userId: a.userId,
            clubId: clubId,
            title: 'Nuevo ticket de soporte',
            message: `${subject} [${ticket.code}]`,
            link: `/admin/support?ticket=${ticket.id}`,
          },
        })
      )
    )
  } else if (auth.role === 'CLUB_ADMIN' && !clubId) {
    // Notify all SUPER_ADMINs — use a system club placeholder or skip clubId requirement
    // Find a club this admin belongs to for the notification clubId
    const membership = await prisma.clubMembership.findFirst({
      where: { userId: auth.userId, role: 'CLUB_ADMIN', status: 'APPROVED' },
      select: { clubId: true },
    })
    if (membership) {
      const superAdmins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      await Promise.all(
        superAdmins.map((sa) =>
          prisma.notification.create({
            data: {
              userId: sa.id,
              clubId: membership.clubId,
              title: 'Nuevo ticket de soporte',
              message: `${subject} [${ticket.code}]`,
              link: `/superadmin/tickets?ticket=${ticket.id}`,
            },
          })
        )
      )
    }
  }

  await writeAudit({
    clubId: clubId ?? '',
    userId: auth.userId,
    action: 'TICKET_CREATED',
    entity: 'Ticket',
    entityId: ticket.id,
    details: { code, subject, category, priority },
  })

  return ok(ticket, 201)
}
