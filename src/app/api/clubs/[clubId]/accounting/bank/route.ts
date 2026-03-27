import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/clubs/[clubId]/accounting/bank
// Returns computed balance (from BankMovement ledger) + paginated movements
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const type = req.nextUrl.searchParams.get('type') as 'INCOME' | 'EXPENSE' | null
  const source = req.nextUrl.searchParams.get('source') ?? undefined

  // Ensure bank account exists (accounting must be enabled for the club)
  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('Cuenta bancaria no encontrada', 404)

  const where = {
    clubId: params.clubId,
    ...(type ? { type } : {}),
    ...(source ? { source: source as never } : {}),
  }

  // Compute balance via aggregation — never stored, always authoritative
  const [incomeAgg, expenseAgg, movements, total] = await Promise.all([
    prisma.bankMovement.aggregate({
      where: { clubId: params.clubId, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.bankMovement.aggregate({
      where: { clubId: params.clubId, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    prisma.bankMovement.findMany({
      where,
      skip,
      take,
      orderBy: { date: 'desc' },
      include: {
        category: true,
      },
    }),
    prisma.bankMovement.count({ where }),
  ])

  const totalIncome = Number(incomeAgg._sum.amount ?? 0)
  const totalExpense = Number(expenseAgg._sum.amount ?? 0)
  const balance = totalIncome - totalExpense

  return ok({
    bankAccount: {
      id: bankAccount.id,
      clubId: bankAccount.clubId,
      bankName: bankAccount.bankName,
      iban: bankAccount.iban,
      holder: bankAccount.holder,
      // Computed — authoritative
      balance,
      totalIncome,
      totalExpense,
    },
    ledger: buildPaginatedResponse(movements, total, page, pageSize),
  })
}
