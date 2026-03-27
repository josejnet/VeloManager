import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PayOrderSchema = z.object({
  // Optional: override the payment description recorded in accounting
  note: z.string().max(300).optional(),
  // Optional: mark which income category to use (if club has custom categories)
  incomeCategoryId: z.string().optional(),
})

// POST /api/clubs/[clubId]/orders/[orderId]/pay
// CLUB_ADMIN marks an order as PAID and creates the corresponding bank income transaction
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; orderId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  const parsed = PayOrderSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  // Fetch order with window and member info
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, clubId: params.clubId },
    include: {
      user: { select: { name: true } },
      purchaseWindow: { select: { name: true } },
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  })

  if (!order) return err('Pedido no encontrado', 404)
  if (order.status === 'PAID') return err('Este pedido ya está marcado como pagado', 409)
  if (order.status === 'CANCELLED') return err('No se puede pagar un pedido cancelado', 400)

  // Ensure the club has a bank account
  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('El club no tiene una cuenta bancaria configurada', 422)

  const amount = Number(order.totalAmount)
  const description = parsed.data.note
    ?? `Pago pedido #${order.id.slice(-6).toUpperCase()} — ${order.user.name} — ${order.purchaseWindow.name}`

  // Atomic: mark order as PAID + create bank income transaction
  const [updatedOrder, transaction] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    }),
    prisma.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        clubId: params.clubId,
        type: 'INCOME',
        amount,
        description,
        date: new Date(),
        incomeCategoryId: parsed.data.incomeCategoryId ?? null,
        // Link transaction back to the order for traceability
        // (no orderId foreign key in Transaction, so we store it in description)
      },
    }),
    prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: { balance: { increment: amount } },
    }),
  ])

  // Notify the member
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
    action: 'ORDER_PAID',
    entity: 'Order',
    entityId: order.id,
    details: {
      member: order.user.name,
      campaign: order.purchaseWindow.name,
      amount,
      transactionId: transaction.id,
    },
  })

  return ok({ order: updatedOrder, transaction })
}
