/**
 * Ledger service — single source of truth for all financial writes.
 *
 * Every money movement goes through createLedgerEntry().
 * Uses BankMovement model with dedup via (source, sourceId) unique constraint.
 * Balance is computed as SUM(INCOME) - SUM(EXPENSE) — never stored.
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { TransactionType, MovementSource } from '@prisma/client'

export type LedgerSourceType =
  | 'invoice'
  | 'quota'
  | 'event_payment'
  | 'order_payment'
  | 'manual'

const SOURCE_MAP: Record<LedgerSourceType, MovementSource> = {
  invoice: 'INVOICE',
  quota: 'FEE',
  event_payment: 'EVENT',
  order_payment: 'ORDER',
  manual: 'MANUAL',
}

export interface LedgerEntryParams {
  clubId: string
  type: TransactionType
  amount: number | string
  description: string
  sourceType: LedgerSourceType
  sourceId: string
  date?: Date
  categoryId?: string
  // Legacy aliases for backwards compatibility with main-branch callers
  incomeCategoryId?: string
  expenseCategoryId?: string
}

export interface LedgerResult {
  transactionId: string
  newBalance: Prisma.Decimal
}

export async function createLedgerEntry(
  params: LedgerEntryParams,
  tx?: Prisma.TransactionClient,
): Promise<LedgerResult> {
  const db = tx ?? prisma

  const amount = typeof params.amount === 'string'
    ? parseFloat(params.amount)
    : params.amount

  if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a positive number')

  const source = SOURCE_MAP[params.sourceType]
  const categoryId = params.categoryId ?? params.incomeCategoryId ?? params.expenseCategoryId ?? null

  const bankAccount = await db.bankAccount.findUnique({
    where: { clubId: params.clubId },
    select: { id: true },
  })
  if (!bankAccount) throw new Error(`No bank account found for club ${params.clubId}`)

  // Dedup check
  const existing = await db.bankMovement.findUnique({
    where: { source_sourceId: { source, sourceId: params.sourceId } },
    select: { id: true },
  })
  if (existing) throw new Error(`Duplicate: ${params.sourceType}/${params.sourceId} already posted`)

  const movement = await db.bankMovement.create({
    data: {
      clubId: params.clubId,
      type: params.type,
      amount,
      description: params.description,
      source,
      sourceId: params.sourceId,
      categoryId,
      date: params.date ?? new Date(),
    },
    select: { id: true },
  })

  // Compute balance: SUM(INCOME) - SUM(EXPENSE)
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.bankMovement.aggregate({ where: { clubId: params.clubId, type: 'INCOME' }, _sum: { amount: true } }),
    prisma.bankMovement.aggregate({ where: { clubId: params.clubId, type: 'EXPENSE' }, _sum: { amount: true } }),
  ])
  const incomeSum = new Prisma.Decimal(incomeAgg._sum.amount?.toString() ?? '0')
  const expenseSum = new Prisma.Decimal(expenseAgg._sum.amount?.toString() ?? '0')
  const newBalance = incomeSum.minus(expenseSum)

  return { transactionId: movement.id, newBalance }
}
