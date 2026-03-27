import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'
import { createLedgerEntry } from '@/lib/ledger'
import { writeAudit } from '@/lib/audit'

// POST /api/clubs/[clubId]/events/payments/[paymentId]/pay
// Marks an EventPayment as PAID and posts an INCOME entry to the ledger.
export async function POST(
  _req: NextRequest,
  { params }: { params: { clubId: string; paymentId: string } },
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const payment = await prisma.eventPayment.findFirst({
    where: { id: params.paymentId, clubId: params.clubId },
    include: { event: { select: { title: true } } },
  })
  if (!payment) return err('Pago no encontrado', 404)
  if (payment.status === 'PAID') return err('Este pago ya fue registrado', 409)
  if (payment.status === 'WAIVED') return err('Este pago fue condonado y no puede pagarse', 400)

  // Atomic: mark payment as PAID + create ledger entry (dedup via sourceType+sourceId)
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.eventPayment.update({
      where: { id: params.paymentId },
      data: { status: 'PAID', paidAt: new Date() },
    })

    const ledger = await createLedgerEntry(
      {
        clubId: params.clubId,
        type: 'INCOME',
        amount: Number(payment.amount),
        description: `Pago evento: ${payment.event.title}`,
        sourceType: 'event_payment',
        sourceId: params.paymentId,
      },
      tx,
    )

    return { updated, ledger }
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'EVENT_PAYMENT_PAID',
    entity: 'EventPayment',
    entityId: params.paymentId,
    details: {
      eventTitle: payment.event.title,
      amount: Number(payment.amount),
      transactionId: result.ledger.transactionId,
      newBalance: result.ledger.newBalance.toNumber(),
    },
  })

  return ok({ payment: result.updated, transactionId: result.ledger.transactionId })
}
