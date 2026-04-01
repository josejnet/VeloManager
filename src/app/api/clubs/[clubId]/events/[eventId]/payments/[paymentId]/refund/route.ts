import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'
import { applyRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const RefundSchema = z.object({
  note: z.string().max(500).optional(),
})

/**
 * POST /api/clubs/[clubId]/events/[eventId]/payments/[paymentId]/refund
 *
 * Refunds a PAID event payment:
 * - Sets status → REFUNDED, records refundedAt + refundNote
 * - Creates an ADJUSTMENT BankMovement (EXPENSE) to reverse the original income
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string; paymentId: string } },
) {
  const limited = applyRateLimit(req)
  if (limited) return limited

  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  const parsed = RefundSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const payment = await prisma.eventPayment.findFirst({
    where: { id: params.paymentId, eventId: params.eventId, clubId: params.clubId },
    include: {
      event: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
  })

  if (!payment) return err('Pago no encontrado', 404)
  if (payment.status !== 'PAID') return err('Solo se pueden devolver pagos en estado PAGADO')

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.eventPayment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        refundedAt: now,
        refundNote: parsed.data.note ?? null,
      },
    })

    const sourceId = `refund:event:${payment.id}`
    const existing = await tx.bankMovement.findUnique({
      where: { source_sourceId: { source: 'ADJUSTMENT', sourceId } },
      select: { id: true },
    })

    if (!existing) {
      await tx.bankMovement.create({
        data: {
          clubId: params.clubId,
          type: 'EXPENSE',
          amount: payment.amount,
          description: `Devolución inscripción "${payment.event.title}" — ${payment.user.name ?? payment.user.email}${parsed.data.note ? ` (${parsed.data.note})` : ''}`,
          source: 'ADJUSTMENT',
          sourceId,
          date: now,
        },
      })
    }
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.EVENT_PAYMENT_REFUNDED,
    entity: 'EventPayment',
    entityId: payment.id,
    details: { eventId: params.eventId, amount: payment.amount.toString(), note: parsed.data.note },
  })

  return ok({ success: true, paymentId: payment.id })
}
