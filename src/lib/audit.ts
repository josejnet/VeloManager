import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface AuditParams {
  clubId: string
  userId: string
  action: string  // e.g. 'APPROVE', 'PAY', 'CREATE', 'UPDATE', 'DELETE'
  entity: string  // e.g. 'Invoice', 'MemberQuota', 'Member'
  entityId?: string
  details?: Record<string, unknown>
  ip?: string
}

/**
 * Write an immutable audit log entry.
 * Never throws — audit failures must not break the main operation.
 */
export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...params,
        details: params.details as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (e) {
    console.error('[Audit] Failed to write log', e)
  }
}

/**
 * Common action constants — use these to keep audit logs consistent.
 */
export const AUDIT = {
  // Members
  MEMBER_APPROVED: 'MEMBER_APPROVED',
  MEMBER_REJECTED: 'MEMBER_REJECTED',
  MEMBER_SUSPENDED: 'MEMBER_SUSPENDED',

  // Accounting
  MOVEMENT_CREATED: 'MOVEMENT_CREATED',         // manual ledger entry
  MOVEMENT_ADJUSTED: 'MOVEMENT_ADJUSTED',       // corrective/reversal entry
  INVOICE_APPROVED: 'INVOICE_APPROVED',
  INVOICE_CREATED: 'INVOICE_CREATED',
  QUOTA_PAID: 'QUOTA_PAID',
  QUOTA_REVERTED: 'QUOTA_REVERTED',
  QUOTA_CREATED: 'QUOTA_CREATED',
  FEE_BULK_GENERATED: 'FEE_BULK_GENERATED',     // bulk fee generation for all members
  EVENT_PAYMENT_RECORDED: 'EVENT_PAYMENT_RECORDED',
  ORDER_PAYMENT_RECORDED: 'ORDER_PAYMENT_RECORDED',
  QUOTA_REFUNDED: 'QUOTA_REFUNDED',
  EVENT_PAYMENT_REFUNDED: 'EVENT_PAYMENT_REFUNDED',
  ORDER_PAYMENT_REFUNDED: 'ORDER_PAYMENT_REFUNDED',
  PAYMENT_STATUS_CHANGED: 'PAYMENT_STATUS_CHANGED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',

  // Purchases
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  WINDOW_OPENED: 'WINDOW_OPENED',
  WINDOW_CLOSED: 'WINDOW_CLOSED',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',

  // Votes
  VOTE_CREATED: 'VOTE_CREATED',
  VOTE_CLOSED: 'VOTE_CLOSED',
  VOTE_CAST: 'VOTE_CAST',

  // Club
  CLUB_SETTINGS_UPDATED: 'CLUB_SETTINGS_UPDATED',

  // Invitations
  INVITATION_CREATED: 'INVITATION_CREATED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITATION_ACCEPTED: 'INVITATION_ACCEPTED',

  // Members (extended)
  MEMBER_BANNED: 'MEMBER_BANNED',
  MEMBER_UNBANNED: 'MEMBER_UNBANNED',
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  MEMBER_LEFT: 'MEMBER_LEFT',
} as const
