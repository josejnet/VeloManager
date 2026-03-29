import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const PatchMovementSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_category'),
    categoryId: z.string().nullable(),
  }),
  z.object({
    action: z.literal('mark_invoice'),
    supplier: z.string().min(1).max(200).optional(),
  }),
])

// PATCH /api/clubs/[clubId]/accounting/movements/[movementId]
// Allowed metadata-only mutations:
//   set_category  — attach/detach a ledger category
//   mark_invoice  — create an Invoice record from this movement and link it
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; movementId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = PatchMovementSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const movement = await prisma.bankMovement.findFirst({
    where: { id: params.movementId, clubId: params.clubId },
  })
  if (!movement) return err('Movimiento no encontrado', 404)

  if (parsed.data.action === 'set_category') {
    const { categoryId } = parsed.data

    if (categoryId) {
      const cat = await prisma.ledgerCategory.findFirst({
        where: { id: categoryId, clubId: params.clubId, type: movement.type },
      })
      if (!cat) return err('Categoría no válida para este tipo de movimiento', 400)
    }

    const updated = await prisma.bankMovement.update({
      where: { id: params.movementId },
      data: { categoryId: categoryId ?? null },
      include: { category: true },
    })

    await writeAudit({
      clubId: params.clubId,
      userId: access.userId,
      action: 'MOVEMENT_CATEGORY_SET',
      entity: 'BankMovement',
      entityId: params.movementId,
      details: { categoryId },
    })

    return ok(updated)
  }

  if (parsed.data.action === 'mark_invoice') {
    if (movement.type !== 'EXPENSE') return err('Solo se pueden convertir gastos en facturas')
    if (['FEE', 'EVENT', 'ORDER', 'INVOICE'].includes(movement.source)) {
      return err('No se puede marcar como factura: origen no permitido')
    }

    const supplier = parsed.data.supplier ?? movement.description

    // Create Invoice (approved=true — movement already in books) + update movement source
    const invoice = await prisma.invoice.create({
      data: {
        clubId: params.clubId,
        amount: movement.amount,
        description: movement.description,
        supplier,
        date: movement.date,
        approved: true,
      },
    })

    await prisma.bankMovement.update({
      where: { id: params.movementId },
      data: { source: 'INVOICE', sourceId: invoice.id },
    })

    await writeAudit({
      clubId: params.clubId,
      userId: access.userId,
      action: 'MOVEMENT_MARKED_INVOICE',
      entity: 'BankMovement',
      entityId: params.movementId,
      details: { invoiceId: invoice.id, supplier },
    })

    return ok({ invoice })
  }

  return err('Acción no válida')
}
