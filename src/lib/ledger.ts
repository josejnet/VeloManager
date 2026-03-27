/**
 * Ledger service — single source of truth for all financial writes.
 *
 * Every money movement in the system goes through createLedgerEntry().
 * This guarantees:
 *   1. Atomicity   — balance update + transaction row in one DB transaction
 *   2. Dedup       — (sourceType, sourceId) unique constraint prevents double-posting
 *   3. Immutability — no UPDATE/DELETE exposed; reversals are new entries
 *   4. Audit trail — caller is responsible for writeAudit() after this returns
 */
import { prisma } from '@/lib/prisma'
import type { TransactionType, Prisma } from '@prisma/client'

export type LedgerSourceType =
  | 'invoice'
  | 'quota'
  | 'event_payment'
  | 'order_payment'
  | 'manual'

export interface LedgerEntryParams {
  clubId: string
  type: TransactionType          // INCOME | EXPENSE
  amount: number | string        // positive value
  description: string
  sourceType: LedgerSourceType
  sourceId: string               // ID of the originating record
  date?: Date
  incomeCategoryId?: string
  expenseCategoryId?: string
}

export interface LedgerResult {
  transactionId: string
  newBalance: Prisma.Decimal
}

/**
 * Creates a ledger entry atomically.
 *
 * Throws if:
 * - The club has no BankAccount yet
 * - An EXPENSE would make the balance negative
 * - A transaction already exists for (sourceType, sourceId) — dedup guard
 */
export async function createLedgerEntry(
  params: LedgerEntryParams,
  /** Pass an active Prisma transaction client to participate in a larger tx */
  tx?: Prisma.TransactionClient,
): Promise<LedgerResult> {
  const db = tx ?? prisma

  const amount = typeof params.amount === 'string'
    ? parseFloat(params.amount)
    : params.amount

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number')
  }

  // ── Dedup check ────────────────────────────────────────────────────────────
  const existing = await db.transaction.findUnique({
    where: { sourceType_sourceId: { sourceType: params.sourceType, sourceId: params.sourceId } },
    select: { id: true },
  })
  if (existing) {
    throw new Error(`Duplicate ledger entry: ${params.sourceType}/${params.sourceId} already posted`)
  }

  // ── Load bank account ──────────────────────────────────────────────────────
  const bankAccount = await db.bankAccount.findUnique({
    where: { clubId: params.clubId },
    select: { id: true, balance: true },
  })
  if (!bankAccount) {
    throw new Error(`No bank account found for club ${params.clubId}`)
  }

  // ── Balance guard for expenses ─────────────────────────────────────────────
  if (params.type === 'EXPENSE' && bankAccount.balance.toNumber() < amount) {
    throw new Error('Saldo insuficiente para registrar este gasto')
  }

  // ── Write atomically (or join existing tx) ─────────────────────────────────
  const run = async (client: Prisma.TransactionClient) => {
    const transaction = await client.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        clubId: params.clubId,
        type: params.type,
        amount,
        description: params.description,
        date: params.date ?? new Date(),
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        incomeCategoryId: params.incomeCategoryId,
        expenseCategoryId: params.expenseCategoryId,
      },
      select: { id: true },
    })

    const updated = await client.bankAccount.update({
      where: { id: bankAccount.id },
      data: {
        balance: params.type === 'INCOME'
          ? { increment: amount }
          : { decrement: amount },
      },
      select: { balance: true },
    })

    return { transactionId: transaction.id, newBalance: updated.balance }
  }

  // If caller provided a tx client, use it directly; otherwise wrap in new tx
  if (tx) {
    return run(tx)
  }
  return prisma.$transaction(run)
}
