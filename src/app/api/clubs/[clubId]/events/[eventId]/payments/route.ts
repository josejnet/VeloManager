import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'
import { writeAudit, AUDIT } from '@/lib/audit'

const CreateEventPaymentSchema = z.object({
  userId: z.string().min(1),           // member to charge
  amount: z.number().positive(),
  notes: z.string().max(300).optional(),
})

// GET /api/clubs/[clubId]/events/[eventId]/payments
// Returns all payment records for the event (CLUB_ADMIN only)
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } },
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { id: true, title: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const payments = await prisma.eventPayment.findMany({
    where: { eventId: params.eventId, clubId: params.clubId },
    orderBy: { createdAt: 'desc' },
  })

  return ok({ event, payments })
}

// POST /api/clubs/[clubId]/events/[eventId]/payments
// Create a pending payment record for a member (CLUB_ADMIN only)
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } },
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateEventPaymentSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { id: true, title: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  // Verify the user is a member of the club
  const membership = await prisma.clubMembership.findFirst({
    where: { userId: parsed.data.userId, clubId: params.clubId, status: 'APPROVED' },
    select: { id: true },
  })
  if (!membership) return err('El usuario no es socio de este club', 400)

  // Prevent duplicate payment records (unique constraint: eventId + userId)
  const existing = await prisma.eventPayment.findUnique({
    where: { eventId_userId: { eventId: params.eventId, userId: parsed.data.userId } },
  })
  if (existing) return err('Ya existe un registro de pago para este socio en este evento', 409)

  const payment = await prisma.eventPayment.create({
    data: {
      eventId: params.eventId,
      userId: parsed.data.userId,
      clubId: params.clubId,
      amount: parsed.data.amount,
      notes: parsed.data.notes,
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'EVENT_PAYMENT_CREATED',
    entity: 'EventPayment',
    entityId: payment.id,
    details: { eventTitle: event.title, amount: parsed.data.amount, userId: parsed.data.userId },
  })

  return ok(payment, 201)
}
