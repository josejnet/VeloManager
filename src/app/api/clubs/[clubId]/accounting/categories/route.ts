import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// GET /api/clubs/[clubId]/accounting/categories
// Returns income and expense categories grouped by type
export async function GET(_req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const categories = await prisma.ledgerCategory.findMany({
    where: { clubId: params.clubId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const income = categories.filter((c) => c.type === 'INCOME')
  const expense = categories.filter((c) => c.type === 'EXPENSE')

  return ok({ income, expense, all: categories })
}

// POST /api/clubs/[clubId]/accounting/categories
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateCategorySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const existing = await prisma.ledgerCategory.findUnique({
    where: { clubId_name_type: { clubId: params.clubId, name: parsed.data.name, type: parsed.data.type } },
  })
  if (existing) return err('Ya existe una categoría con ese nombre y tipo', 409)

  const category = await prisma.ledgerCategory.create({
    data: { clubId: params.clubId, ...parsed.data },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.CATEGORY_CREATED,
    entity: 'LedgerCategory',
    entityId: category.id,
    details: { name: category.name, type: category.type },
  })

  return ok(category, 201)
}

// DELETE /api/clubs/[clubId]/accounting/categories?id=xxx
export async function DELETE(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return err('id requerido')

  const category = await prisma.ledgerCategory.findFirst({
    where: { id, clubId: params.clubId },
    include: { _count: { select: { movements: true } } },
  })
  if (!category) return err('Categoría no encontrada', 404)
  if (category._count.movements > 0) {
    return err('No se puede eliminar una categoría con movimientos asociados', 409)
  }

  await prisma.ledgerCategory.delete({ where: { id } })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.CATEGORY_DELETED,
    entity: 'LedgerCategory',
    entityId: id,
    details: { name: category.name, type: category.type },
  })

  return ok({ deleted: true })
}
