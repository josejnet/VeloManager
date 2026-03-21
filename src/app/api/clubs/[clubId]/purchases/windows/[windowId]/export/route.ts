import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

/**
 * GET /api/clubs/[clubId]/purchases/windows/[windowId]/export
 * Returns two reports for production:
 * - summary: [product | size | totalQuantity] (for supplier)
 * - detail: [member | product | size | quantity] (internal)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; windowId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const window = await prisma.purchaseWindow.findFirst({
    where: { id: params.windowId, clubId: params.clubId },
  })
  if (!window) return err('Ventana de compra no encontrada', 404)

  // Aggregate: total units per product+size
  const summaryRaw = await prisma.orderItem.groupBy({
    by: ['productId', 'size'],
    where: {
      clubId: params.clubId,
      order: { purchaseWindowId: params.windowId, status: { not: 'CANCELLED' } },
    },
    _sum: { quantity: true },
    orderBy: [{ productId: 'asc' }, { size: 'asc' }],
  })

  // Get product names
  const productIds = Array.from(new Set(summaryRaw.map((r) => r.productId)))
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  })
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))

  const summary = summaryRaw.map((r) => ({
    productId: r.productId,
    productName: productMap[r.productId] ?? r.productId,
    size: r.size,
    totalQuantity: r._sum.quantity ?? 0,
  }))

  // Detail: per member
  const orders = await prisma.order.findMany({
    where: {
      purchaseWindowId: params.windowId,
      clubId: params.clubId,
      status: { not: 'CANCELLED' },
    },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const detail = orders.flatMap((order) =>
    order.items.map((item) => ({
      memberName: order.user.name,
      memberEmail: order.user.email,
      productName: item.product.name,
      size: item.size,
      quantity: item.quantity,
      price: Number(item.price),
      subtotal: Number(item.price) * item.quantity,
    }))
  )

  return ok({
    window: { id: window.id, name: window.name, closedAt: window.closedAt },
    summary,
    detail,
    totals: {
      orders: orders.length,
      items: detail.reduce((s, d) => s + d.quantity, 0),
      revenue: detail.reduce((s, d) => s + d.subtotal, 0),
    },
  })
}
