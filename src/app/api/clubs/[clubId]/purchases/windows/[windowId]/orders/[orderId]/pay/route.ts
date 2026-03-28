import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import { createLedgerEntry } from '@/lib/ledger'
import { writeAudit } from '@/lib/audit'

// POST /api/clubs/[clubId]/purchases/windows/[windowId]/orders/[orderId]/pay
// Marks an Order as CONFIRMED and posts an INCOME entry to the ledger.
export async function POST(
  _req: NextRequest,
  { params }: { params: { clubId: string; windowId: string; orderId: string } },
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, clubId: params.clubId, purchaseWindowId: params.windowId },
    include: { purchaseWindow: { select: { name: true } } },
  })
  if (!order) return err('Pedido no encontrado', 404)
  if (order.status === 'CANCELLED') return err('El pedido está cancelado y no puede pagarse', 400)
  if (order.status === 'CONFIRMED' || order.status === 'DELIVERED') {
    return err('Este pedido ya fue pagado', 409)
  }

  // Atomic: mark order as CONFIRMED + create ledger entry (dedup via sourceType+sourceId)
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: params.orderId },
      data: { status: 'CONFIRMED' },
    })

    const ledger = await createLedgerEntry(
      {
        clubId: params.clubId,
        type: 'INCOME',
        amount: Number(order.totalAmount),
        description: `Pago pedido: ${order.purchaseWindow.name}`,
        sourceType: 'order_payment',
        sourceId: params.orderId,
      },
      tx,
    )

    return { updated, ledger }
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'ORDER_PAYMENT_PAID',
    entity: 'Order',
    entityId: params.orderId,
    details: {
      windowName: order.purchaseWindow.name,
      amount: Number(order.totalAmount),
      transactionId: result.ledger.transactionId,
      newBalance: result.ledger.newBalance.toNumber(),
    },
  })

  return ok({ order: result.updated, transactionId: result.ledger.transactionId })
}
