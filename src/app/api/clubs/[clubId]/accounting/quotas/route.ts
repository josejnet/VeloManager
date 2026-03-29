import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CreateQuotaSchema = z.object({
  membershipId: z.string(),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().positive(),
  dueDate: z.string().optional(),  // ISO date string
})

const PayQuotaSchema = z.object({
  quotaId: z.string(),
  categoryId: z.string().optional(),
})

// GET /api/clubs/[clubId]/accounting/quotas
// CLUB_ADMIN: all member quotas (filterable by status/year)
// SOCIO: only their own quotas
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const isAdmin = access.clubRole === 'ADMIN' || access.platformRole === 'SUPER_ADMIN'
  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = req.nextUrl.searchParams.get('status')
  const year = req.nextUrl.searchParams.get('year')

  // SOCIOs can only see their own quotas
  let membershipId: string | undefined
  if (!isAdmin) {
    const membership = await prisma.clubMembership.findFirst({
      where: { userId: access.userId, clubId: params.clubId },
    })
    if (!membership) return err('Membresía no encontrada', 404)
    membershipId = membership.id
  }

  const where = {
    clubId: params.clubId,
    ...(membershipId ? { membershipId } : {}),
    ...(status ? { status: status as 'PENDING' | 'PAID' | 'OVERDUE' } : {}),
    ...(year ? { year: parseInt(year) } : {}),
  }

  const [quotas, total] = await Promise.all([
    prisma.memberQuota.findMany({
      where,
      skip,
      take,
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        membership: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.memberQuota.count({ where }),
  ])

  return ok(buildPaginatedResponse(quotas, total, page, pageSize))
}

// POST /api/clubs/[clubId]/accounting/quotas — assign a quota to a member
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateQuotaSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const membership = await prisma.clubMembership.findFirst({
    where: { id: parsed.data.membershipId, clubId: params.clubId, status: 'APPROVED' },
    include: { user: { select: { name: true } } },
  })
  if (!membership) return err('Miembro no encontrado en este club', 404)

  const quota = await prisma.memberQuota.create({
    data: {
      membershipId: parsed.data.membershipId,
      clubId: params.clubId,
      year: parsed.data.year,
      amount: parsed.data.amount,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.QUOTA_CREATED,
    entity: 'MemberQuota',
    entityId: quota.id,
    details: { member: membership.user.name, year: parsed.data.year, amount: parsed.data.amount },
  })

  return ok(quota, 201)
}

// PATCH /api/clubs/[clubId]/accounting/quotas — mark quota as paid → creates BankMovement
export async function PATCH(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = PayQuotaSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const quota = await prisma.memberQuota.findFirst({
    where: { id: parsed.data.quotaId, clubId: params.clubId },
    include: {
      membership: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  if (!quota) return err('Cuota no encontrada', 404)
  if (quota.status === 'PAID') return err('La cuota ya está pagada', 409)

  // Idempotency check — no duplicate movement for same quota
  const existing = await prisma.bankMovement.findUnique({
    where: { source_sourceId: { source: 'FEE', sourceId: quota.id } },
  })
  if (existing) return err('Ya existe un movimiento para esta cuota', 409)

  // Mark PAID + create BankMovement atomically
  const [updatedQuota, movement] = await prisma.$transaction([
    prisma.memberQuota.update({
      where: { id: quota.id },
      data: { status: 'PAID', paidAt: new Date() },
    }),
    prisma.bankMovement.create({
      data: {
        clubId: params.clubId,
        type: 'INCOME',
        amount: quota.amount,
        description: `Cuota ${quota.year} — ${quota.membership.user.name}`,
        source: 'FEE',
        sourceId: quota.id,
        categoryId: parsed.data.categoryId ?? null,
        date: new Date(),
      },
    }),
  ])

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.QUOTA_PAID,
    entity: 'MemberQuota',
    entityId: quota.id,
    details: { member: quota.membership.user.name, year: quota.year, amount: Number(quota.amount) },
  })

  await prisma.notification.create({
    data: {
      userId: quota.membership.userId,
      clubId: params.clubId,
      title: `Cuota ${quota.year} registrada`,
      message: `Tu cuota anual ${quota.year} de ${Number(quota.amount).toFixed(2)}€ ha sido registrada como pagada.`,
      link: '/socio/quotas',
    },
  })

  return ok({ quota: updatedQuota, movement })
}

// DELETE /api/clubs/[clubId]/accounting/quotas?quotaId=xxx
// Reverts a PAID quota back to PENDING and creates a reversal ADJUSTMENT entry in accounting.
export async function DELETE(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const quotaId = req.nextUrl.searchParams.get('quotaId')
  if (!quotaId) return err('quotaId requerido', 400)

  const quota = await prisma.memberQuota.findFirst({
    where: { id: quotaId, clubId: params.clubId },
    include: {
      membership: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  if (!quota) return err('Cuota no encontrada', 404)
  if (quota.status !== 'PAID') return err('Solo se pueden revertir cuotas que estén pagadas', 409)

  // Find the linked FEE BankMovement (created when quota was marked paid)
  const originalMovement = await prisma.bankMovement.findUnique({
    where: { source_sourceId: { source: 'FEE', sourceId: quota.id } },
  })

  await prisma.$transaction(async (tx) => {
    // Revert quota to PENDING
    await tx.memberQuota.update({
      where: { id: quota.id },
      data: { status: 'PENDING', paidAt: null },
    })

    // Create ADJUSTMENT (reversal) movement to balance the original income
    if (originalMovement) {
      await tx.bankMovement.create({
        data: {
          clubId: params.clubId,
          type: 'EXPENSE',
          amount: originalMovement.amount,
          description: `Anulación cuota ${quota.year} — ${quota.membership.user.name}`,
          source: 'ADJUSTMENT',
          sourceId: originalMovement.id,
          date: new Date(),
        },
      })
    }
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.QUOTA_REVERTED,
    entity: 'MemberQuota',
    entityId: quota.id,
    details: {
      member: quota.membership.user.name,
      year: quota.year,
      amount: Number(quota.amount),
      adjustmentCreated: !!originalMovement,
    },
  })

  return ok({ reverted: true })
}
