import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

// POST /api/clubs/[clubId]/accounting/invoices/[invoiceId]/approve
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

  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('Cuenta bancaria no encontrada', 404)

  // Approve invoice + deduct from bank in a single transaction
  const [updatedInvoice, transaction] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { approved: true },
    }),
    prisma.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        clubId: params.clubId,
        type: 'EXPENSE',
        amount: invoice.amount,
        description: `Factura: ${invoice.description} (${invoice.supplier})`,
        date: invoice.date,
        invoiceId: params.invoiceId,
      },
    }),
    prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: { balance: { decrement: invoice.amount } },
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

  return ok({ invoice: updatedInvoice, transaction })
}
