import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const CreateTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  description: z.string().min(1).max(300),
  date: z.string().optional(),
  incomeCategoryId: z.string().optional(),
  expenseCategoryId: z.string().optional(),
})

// POST /api/clubs/[clubId]/accounting/transactions — manual income/expense entry
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateTransactionSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('Cuenta bancaria no encontrada', 404)

  const amount = parsed.data.amount
  const delta = parsed.data.type === 'INCOME' ? amount : -amount

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        clubId: params.clubId,
        type: parsed.data.type,
        amount,
        description: parsed.data.description,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        incomeCategoryId: parsed.data.incomeCategoryId,
        expenseCategoryId: parsed.data.expenseCategoryId,
      },
    }),
    prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: { balance: { increment: delta } },
    }),
  ])

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.TRANSACTION_CREATED,
    entity: 'Transaction',
    entityId: transaction.id,
    details: { type: parsed.data.type, amount, description: parsed.data.description },
  })

  return ok(transaction, 201)
}
