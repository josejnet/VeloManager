import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CartItemSchema = z.object({
  productId: z.string(),
  size: z.string().min(1, 'La talla es obligatoria'),
  quantity: z.number().int().min(1).max(100, 'La cantidad no puede superar 100 unidades por producto'),
})

const PlaceOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
})

// GET /api/clubs/[clubId]/purchases/windows/[windowId]/orders
// — CLUB_ADMIN sees all orders; SOCIO sees only their own
export async function GET(
  req: NextRequest,
  { params }: { params: { clubId: string; windowId: string } }
) {
  const access = await requireClubAccess(params.clubId) // SOCIO minimum
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)

  // SOCIOs can only see their own orders
  const isAdmin = access.role === 'CLUB_ADMIN' || access.role === 'SUPER_ADMIN'
  const where = {
    purchaseWindowId: params.windowId,
    clubId: params.clubId,
    ...(isAdmin ? {} : { userId: access.userId }),
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, images: true } } } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return ok(buildPaginatedResponse(orders, total, page, pageSize))
}

// POST /api/clubs/[clubId]/purchases/windows/[windowId]/orders — socio places order
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; windowId: string } }
) {
  const access = await requireClubAccess(params.clubId) // SOCIO minimum
  if (!access.ok) return access.response

  const window = await prisma.purchaseWindow.findFirst({
    where: { id: params.windowId, clubId: params.clubId, status: 'OPEN' },
    include: { products: { include: { product: true } } },
  })
  if (!window) return err('La ventana de compra no está abierta', 400)

  const body = await req.json().catch(() => null)
  const parsed = PlaceOrderSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  // Validate all products belong to this window
  const validProductIds = new Set(window.products.map((p) => p.productId))
  for (const item of parsed.data.items) {
    if (!validProductIds.has(item.productId)) {
      return err(`Producto ${item.productId} no pertenece a esta campaña`, 400)
    }
  }

  // Build price map
  const priceMap = Object.fromEntries(
    window.products.map((p) => [p.productId, Number(p.product.price)])
  )

  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + priceMap[item.productId] * item.quantity,
    0
  )

  // Cancel any existing pending order and create new one atomically to prevent duplicates
  const order = await prisma.$transaction(async (tx) => {
    // Cancel previous pending order within same transaction to avoid race condition
    await tx.order.updateMany({
      where: { userId: access.userId, purchaseWindowId: params.windowId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })

    return tx.order.create({
      data: {
        userId: access.userId,
        clubId: params.clubId,
        purchaseWindowId: params.windowId,
        totalAmount,
        items: {
          create: parsed.data.items.map((item) => ({
            productId: item.productId,
            clubId: params.clubId,
            size: item.size,
            quantity: item.quantity,
            price: priceMap[item.productId],
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    })
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.ORDER_PLACED,
    entity: 'Order',
    entityId: order.id,
    details: { window: window.name, totalAmount, itemCount: parsed.data.items.length },
  })

  return ok(order, 201)
}
