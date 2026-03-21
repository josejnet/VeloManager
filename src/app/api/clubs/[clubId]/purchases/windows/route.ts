import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateWindowSchema = z.object({
  name: z.string().min(1).max(200),
  productIds: z.array(z.string()).min(1),
})

// GET /api/clubs/[clubId]/purchases/windows
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = req.nextUrl.searchParams.get('status')

  const where = {
    clubId: params.clubId,
    ...(status ? { status: status as 'DRAFT' | 'OPEN' | 'CLOSED' } : {}),
  }

  const [windows, total] = await Promise.all([
    prisma.purchaseWindow.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        products: { include: { product: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.purchaseWindow.count({ where }),
  ])

  return ok(buildPaginatedResponse(windows, total, page, pageSize))
}

// POST /api/clubs/[clubId]/purchases/windows
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateWindowSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const window = await prisma.purchaseWindow.create({
    data: {
      clubId: params.clubId,
      name: parsed.data.name,
      products: {
        create: parsed.data.productIds.map((productId) => ({ productId })),
      },
    },
    include: { products: { include: { product: true } } },
  })

  return ok(window, 201)
}
