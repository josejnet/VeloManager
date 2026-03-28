import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CreateEventPaymentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
})

// GET /api/clubs/[clubId]/events/[eventId]/payments
// Admin: list all EventPayments for this event with member details
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { id: true, title: true, price: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const payments = await prisma.eventPayment.findMany({
    where: { eventId: params.eventId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const summary = {
    total: payments.length,
    paid: payments.filter((p) => p.status === 'PAID').length,
    pending: payments.filter((p) => p.status === 'PENDING').length,
    cancelled: payments.filter((p) => p.status === 'CANCELLED').length,
    totalCollected: payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0),
  }

  return ok({ event, payments, summary })
}

// POST /api/clubs/[clubId]/events/[eventId]/payments
// Create a pending payment record for a member (ADMIN only)
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateEventPaymentSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { id: true, title: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const membership = await prisma.clubMembership.findFirst({
    where: { userId: parsed.data.userId, clubId: params.clubId, status: 'APPROVED' },
    select: { id: true },
  })
  if (!membership) return err('El usuario no es socio de este club', 400)

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
    },
  })

  return ok(payment, 201)
}
