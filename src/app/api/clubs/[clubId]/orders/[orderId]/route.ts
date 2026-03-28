import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const UpdateOrderSchema = z.object({
  status: z.enum(['CONFIRMED', 'DELIVERED', 'CANCELLED']),
})

// PATCH /api/clubs/[clubId]/orders/[orderId] — admin updates order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; orderId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateOrderSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, clubId: params.clubId },
    include: {
      user: { select: { name: true } },
      purchaseWindow: { select: { name: true } },
    },
  })

  if (!order) return err('Pedido no encontrado', 404)
  if (order.status === 'PAID' && parsed.data.status === 'CANCELLED') {
    return err('No se puede cancelar un pedido ya pagado. Gestiona la devolución manualmente.', 400)
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: parsed.data.status },
  })

  const notifMap: Record<string, { title: string; message: string }> = {
    CONFIRMED: {
      title: 'Pedido confirmado',
      message: `Tu pedido de "${order.purchaseWindow.name}" ha sido confirmado y está en preparación.`,
    },
    DELIVERED: {
      title: 'Pedido entregado',
      message: `Tu pedido de "${order.purchaseWindow.name}" ha sido marcado como entregado. ¡Disfrútalo!`,
    },
    CANCELLED: {
      title: 'Pedido cancelado',
      message: `Tu pedido de la campaña "${order.purchaseWindow.name}" ha sido cancelado. Contacta al administrador si tienes dudas.`,
    },
  }

  const notif = notifMap[parsed.data.status]
  if (notif) {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        clubId: params.clubId,
        ...notif,
        link: '/socio/purchases',
      },
    })
  }

  const actionMap: Record<string, string> = {
    CONFIRMED: 'ORDER_CONFIRMED',
    DELIVERED: AUDIT.ORDER_DELIVERED,
    CANCELLED: AUDIT.ORDER_CANCELLED,
  }

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: actionMap[parsed.data.status] ?? 'ORDER_STATUS_CHANGED',
    entity: 'Order',
    entityId: order.id,
    details: { member: order.user.name, newStatus: parsed.data.status },
  })

  return ok(updated)
}
