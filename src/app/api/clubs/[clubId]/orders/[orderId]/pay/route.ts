import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PayOrderSchema = z.object({
  note: z.string().max(300).optional(),
  categoryId: z.string().optional(),
})

// POST /api/clubs/[clubId]/orders/[orderId]/pay
// CLUB_ADMIN marks an order as PAID.
// Creates an OrderPayment record and a BankMovement (INCOME, source=ORDER) atomically.
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; orderId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  const parsed = PayOrderSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, clubId: params.clubId },
    include: {
      user: { select: { name: true } },
      purchaseWindow: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  })

  if (!order) return err('Pedido no encontrado', 404)
  if (order.status === 'PAID') return err('Este pedido ya está marcado como pagado', 409)
  if (order.status === 'CANCELLED') return err('No se puede pagar un pedido cancelado', 400)

  // Ensure accounting is enabled for this club
  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('El club no tiene una cuenta bancaria configurada', 422)

  // Idempotency guard — prevent duplicate payments for the same order
  const existingPayment = await prisma.orderPayment.findUnique({ where: { orderId: params.orderId } })
  if (existingPayment?.status === 'PAID') return err('Este pedido ya está registrado como pagado', 409)

  const amount = Number(order.totalAmount)
  const description =
    parsed.data.note ??
    `Pedido #${order.id.slice(-6).toUpperCase()} — ${order.user.name} — ${order.purchaseWindow.name}`

  // Atomic: update order status + create OrderPayment + create BankMovement (INCOME, source=ORDER)
  const [updatedOrder, orderPayment, movement] = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    })

    const payment = await tx.orderPayment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        clubId: params.clubId,
        amount,
        status: 'PAID',
        paidAt: new Date(),
        note: parsed.data.note ?? null,
      },
      update: {
        status: 'PAID',
        paidAt: new Date(),
        note: parsed.data.note ?? null,
      },
    })

    const mov = await tx.bankMovement.create({
      data: {
        clubId: params.clubId,
        type: 'INCOME',
        amount,
        description,
        source: 'ORDER',
        sourceId: payment.id,   // movement points to OrderPayment, not Order directly
        categoryId: parsed.data.categoryId ?? null,
        date: new Date(),
      },
    })

    return [updated, payment, mov]
  })

  await prisma.notification.create({
    data: {
      userId: order.userId,
      clubId: params.clubId,
      title: 'Pago confirmado',
      message: `Tu pedido de la campaña "${order.purchaseWindow.name}" ha sido confirmado como pagado.`,
      link: '/socio/purchases',
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.ORDER_PAYMENT_RECORDED,
    entity: 'Order',
    entityId: order.id,
    details: {
      member: order.user.name,
      campaign: order.purchaseWindow.name,
      amount,
      orderPaymentId: orderPayment.id,
      movementId: movement.id,
    },
  })

  return ok({ order: updatedOrder, payment: orderPayment, movement })
}
