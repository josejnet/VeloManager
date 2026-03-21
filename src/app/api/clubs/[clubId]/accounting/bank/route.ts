import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/clubs/[clubId]/accounting/bank
// Returns bank account + paginated ledger (all transactions, newest first)
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const type = req.nextUrl.searchParams.get('type') // INCOME | EXPENSE | null

  const where = {
    clubId: params.clubId,
    ...(type ? { type: type as 'INCOME' | 'EXPENSE' } : {}),
  }

  const [bankAccount, transactions, total] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { clubId: params.clubId } }),
    prisma.transaction.findMany({
      where,
      skip,
      take,
      orderBy: { date: 'desc' },
      include: {
        incomeCategory: true,
        expenseCategory: true,
        invoice: { select: { id: true, supplier: true, fileUrl: true } },
        quota: {
          include: {
            membership: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ])

  if (!bankAccount) return err('Cuenta bancaria no encontrada', 404)

  return ok({
    bankAccount,
    ledger: buildPaginatedResponse(transactions, total, page, pageSize),
  })
}
