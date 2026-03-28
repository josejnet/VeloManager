import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  availableSizes: z.array(z.string()).default([]),
  totalStock: z.number().int().positive().optional(),
})

// GET /api/clubs/[clubId]/purchases/products
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const activeOnly = req.nextUrl.searchParams.get('active') !== 'false'

  const where = { clubId: params.clubId, ...(activeOnly ? { active: true } : {}) }

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.product.count({ where }),
  ])

  return ok(buildPaginatedResponse(products, total, page, pageSize))
}

// POST /api/clubs/[clubId]/purchases/products
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = ProductSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const product = await prisma.product.create({
    data: { ...parsed.data, clubId: params.clubId },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.PRODUCT_CREATED,
    entity: 'Product',
    entityId: product.id,
    details: { name: product.name, price: Number(product.price) },
  })

  return ok(product, 201)
}
