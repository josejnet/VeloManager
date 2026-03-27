import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

// POST /api/clubs/[clubId]/accounting/invoices/[invoiceId] — approve invoice → BankMovement (EXPENSE)
export async function POST(
  _req: NextRequest,
  { params }: { params: { clubId: string; invoiceId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, clubId: params.clubId },
  })
  if (!invoice) return err('Factura no encontrada', 404)
  if (invoice.approved) return err('Factura ya aprobada', 409)

  // Idempotency guard
  const existing = await prisma.bankMovement.findUnique({
    where: { source_sourceId: { source: 'INVOICE', sourceId: params.invoiceId } },
  })
  if (existing) return err('Ya existe un movimiento para esta factura', 409)

  // Approve invoice + create EXPENSE BankMovement atomically
  const [updatedInvoice, movement] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { approved: true },
    }),
    prisma.bankMovement.create({
      data: {
        clubId: params.clubId,
        type: 'EXPENSE',
        amount: invoice.amount,
        description: `Factura: ${invoice.description} (${invoice.supplier})`,
        source: 'INVOICE',
        sourceId: params.invoiceId,
        date: invoice.date,
      },
    }),
  ])

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.INVOICE_APPROVED,
    entity: 'Invoice',
    entityId: params.invoiceId,
    details: { supplier: invoice.supplier, amount: Number(invoice.amount) },
  })

  return ok({ invoice: updatedInvoice, movement })
}
