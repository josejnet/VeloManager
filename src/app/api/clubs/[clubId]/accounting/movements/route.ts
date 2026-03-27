import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CreateMovementSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  description: z.string().min(1).max(300),
  date: z.string().optional(),
  categoryId: z.string().optional(),
  // ADJUSTMENT: links this corrective entry back to the movement being reversed
  adjustedMovementId: z.string().optional(),
})

// POST /api/clubs/[clubId]/accounting/movements — create a manual or adjustment entry
// Entries are append-only: existing movements can never be modified.
// To correct an error, create a new ADJUSTMENT movement (e.g. reverse an expense with an income).
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  // Bank account must exist (accounting enabled for this club)
  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('Cuenta bancaria no configurada para este club', 422)

  const body = await req.json().catch(() => null)
  const parsed = CreateMovementSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const source = parsed.data.adjustedMovementId ? 'ADJUSTMENT' : 'MANUAL'

  // If referencing an adjustment, validate the original movement exists in this club
  if (parsed.data.adjustedMovementId) {
    const original = await prisma.bankMovement.findFirst({
      where: { id: parsed.data.adjustedMovementId, clubId: params.clubId },
    })
    if (!original) return err('Movimiento original no encontrado', 404)
  }

  // Validate category belongs to this club and matches the movement type
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
      source,
      // For ADJUSTMENT, sourceId links to the original movement being corrected
      sourceId: parsed.data.adjustedMovementId ?? null,
    },
  })

  const action = source === 'ADJUSTMENT' ? AUDIT.MOVEMENT_ADJUSTED : AUDIT.MOVEMENT_CREATED
  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action,
    entity: 'BankMovement',
    entityId: movement.id,
    details: { type: parsed.data.type, amount: parsed.data.amount, description: parsed.data.description },
  })

  return ok(movement, 201)
}
