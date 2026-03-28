import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CreateTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  description: z.string().min(1).max(300),
  date: z.string().optional(),
  categoryId: z.string().optional(),
})

// POST /api/clubs/[clubId]/accounting/transactions
// Kept for backward compatibility — delegates to BankMovement (MANUAL source).
// Prefer /accounting/movements for new integrations.
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('Cuenta bancaria no encontrada', 404)

  const body = await req.json().catch(() => null)
  const parsed = CreateTransactionSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  if (parsed.data.categoryId) {
    const cat = await prisma.ledgerCategory.findFirst({
      where: { id: parsed.data.categoryId, clubId: params.clubId, type: parsed.data.type },
    })
    if (!cat) return err('Categoría no válida para este tipo de movimiento', 400)
  }

  const movement = await prisma.bankMovement.create({
    data: {
      clubId: params.clubId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      categoryId: parsed.data.categoryId ?? null,
      source: 'MANUAL',
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.MOVEMENT_CREATED,
    entity: 'BankMovement',
    entityId: movement.id,
    details: { type: parsed.data.type, amount: parsed.data.amount, description: parsed.data.description },
  })

  return ok(movement, 201)
}
