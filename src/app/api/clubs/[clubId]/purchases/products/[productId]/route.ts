import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().positive().optional(),
  images: z.array(z.string().url()).optional(),
  availableSizes: z.array(z.string()).optional(),
  totalStock: z.number().int().positive().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  sizeGroupId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  activeFrom: z.string().datetime().nullable().optional(),
  activeTo: z.string().datetime().nullable().optional(),
})

// GET /api/clubs/[clubId]/purchases/products/[productId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; productId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const product = await prisma.product.findFirst({
    where: { id: params.productId, clubId: params.clubId },
    include: { productCategory: true, sizeGroup: true },
  })

  if (!product) return err('Producto no encontrado', 404)
  return ok(product)
}

// PATCH /api/clubs/[clubId]/purchases/products/[productId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; productId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateProductSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const product = await prisma.product.findFirst({
    where: { id: params.productId, clubId: params.clubId },
  })
  if (!product) return err('Producto no encontrado', 404)

  const updated = await prisma.product.update({
    where: { id: params.productId },
    data: {
      ...parsed.data,
      activeFrom: parsed.data.activeFrom ? new Date(parsed.data.activeFrom) : undefined,
      activeTo: parsed.data.activeTo ? new Date(parsed.data.activeTo) : undefined,
    },
    include: { productCategory: true, sizeGroup: true },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.PRODUCT_UPDATED,
    entity: 'Product',
    entityId: params.productId,
    details: parsed.data,
  })

  return ok(updated)
}

// DELETE /api/clubs/[clubId]/purchases/products/[productId] — soft delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; productId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  await prisma.product.update({
    where: { id: params.productId },
    data: { active: false },
  })

  return ok({ success: true })
}
