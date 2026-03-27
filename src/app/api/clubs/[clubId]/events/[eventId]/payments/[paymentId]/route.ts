import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST /api/clubs/[clubId]/events/[eventId]/payments/[paymentId]/pay
// Admin: mark an EventPayment as PAID and create BankMovement (idempotent)
export async function POST(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string; paymentId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const payment = await prisma.eventPayment.findFirst({
    where: { id: params.paymentId, eventId: params.eventId, clubId: params.clubId },
    include: {
      event: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
  })
  if (!payment) return err('Pago no encontrado', 404)

  if (payment.status === 'PAID') {
    return err('Este pago ya ha sido registrado', 409)
  }
  if (payment.status === 'CANCELLED') {
    return err('Este pago fue cancelado y no puede procesarse', 409)
  }

  // Idempotency guard: BankMovement already exists for this payment?
  const existingMovement = await prisma.bankMovement.findUnique({
    where: { source_sourceId: { source: 'EVENT', sourceId: payment.id } },
  })
  if (existingMovement) {
    // Edge case: payment wasn't marked PAID but movement exists — sync state
    await prisma.eventPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: existingMovement.date },
    })
    return ok({ payment: { ...payment, status: 'PAID' }, movement: existingMovement })
  }

  const [updatedPayment, movement] = await prisma.$transaction(async (tx) => {
    const pmt = await tx.eventPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: new Date() },
    })
    const mov = await tx.bankMovement.create({
      data: {
        clubId: params.clubId,
        type: 'INCOME',
        amount: payment.amount,
        description: `Pago evento: ${payment.event.title} — ${payment.user.name ?? payment.user.email}`,
        source: 'EVENT',
        sourceId: payment.id,
        date: new Date(),
      },
    })
    return [pmt, mov]
  })

  await writeAudit({
    userId: access.userId,
    clubId: params.clubId,
    action: 'EVENT_PAYMENT_RECORDED',
    targetType: 'EventPayment',
    targetId: payment.id,
    metadata: { amount: Number(payment.amount), eventId: params.eventId, movementId: movement.id },
  })

  return ok({ payment: updatedPayment, movement })
}
