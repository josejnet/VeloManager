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
  dueDate: z.string().optional(),
  markPaid: z.boolean().optional(),           // PAID + BankMovement (accounting impact)
  markPaidHistorical: z.boolean().optional(), // PAID, no BankMovement (retroactive, no accounting impact)
})

const PatchQuotaSchema = z.discriminatedUnion('action', [
  // Mark as paid with accounting impact (creates BankMovement)
  z.object({ action: z.literal('mark_paid'), quotaId: z.string(), categoryId: z.string().optional() }),
  // Mark as paid retroactively — no BankMovement created
  z.object({ action: z.literal('mark_paid_historical'), quotaId: z.string() }),
  // Revert to pending (only if no BankMovement exists for this quota)
  z.object({ action: z.literal('mark_pending'), quotaId: z.string() }),
  // Mark as overdue (only from PENDING)
  z.object({ action: z.literal('mark_overdue'), quotaId: z.string() }),
  // Edit amount and/or due date (only for PENDING or OVERDUE)
  z.object({
    action: z.literal('edit'),
    quotaId: z.string(),
    amount: z.number().positive().optional(),
    dueDate: z.string().nullable().optional(),
  }),
])

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

  // Auto-create bank account if needed (idempotent)
  await prisma.bankAccount.upsert({
    where: { clubId: params.clubId },
    create: { clubId: params.clubId },
    update: {},
  })

  const now = new Date()
  const baseData = {
    membershipId: parsed.data.membershipId,
    clubId: params.clubId,
    year: parsed.data.year,
    amount: parsed.data.amount,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
  }

  if (parsed.data.markPaid) {
    // Paid now → create quota as PAID + BankMovement (accounting impact)
    const [quota] = await prisma.$transaction([
      prisma.memberQuota.create({ data: { ...baseData, status: 'PAID', paidAt: now } }),
    ])
    await prisma.bankMovement.create({
      data: {
        clubId: params.clubId,
        type: 'INCOME',
        amount: parsed.data.amount,
        description: `Cuota ${parsed.data.year} — ${membership.user.name}`,
        source: 'FEE',
        sourceId: quota.id,
        date: now,
      },
    })
    await writeAudit({
      clubId: params.clubId,
      userId: access.userId,
      action: AUDIT.QUOTA_PAID,
      entity: 'MemberQuota',
      entityId: quota.id,
      details: { member: membership.user.name, year: parsed.data.year, amount: parsed.data.amount, autoPaid: true },
    })
    await prisma.notification.create({
      data: {
        userId: membership.userId,
        clubId: params.clubId,
        title: `Cuota ${parsed.data.year} registrada`,
        message: `Tu cuota anual ${parsed.data.year} de ${parsed.data.amount.toFixed(2)}€ ha sido registrada como pagada.`,
        link: '/socio/quotas',
      },
    })
    return ok(quota, 201)
  }

  if (parsed.data.markPaidHistorical) {
    // Paid in the past → create quota as PAID, no BankMovement (no accounting impact)
    const quota = await prisma.memberQuota.create({
      data: { ...baseData, status: 'PAID', paidAt: now },
    })
    await writeAudit({
      clubId: params.clubId,
      userId: access.userId,
      action: AUDIT.QUOTA_PAID,
      entity: 'MemberQuota',
      entityId: quota.id,
      details: { member: membership.user.name, year: parsed.data.year, amount: parsed.data.amount, historical: true },
    })
    await prisma.notification.create({
      data: {
        userId: membership.userId,
        clubId: params.clubId,
        title: `Cuota ${parsed.data.year} registrada`,
        message: `Tu cuota anual ${parsed.data.year} de ${parsed.data.amount.toFixed(2)}€ ha sido registrada como pagada.`,
        link: '/socio/quotas',
      },
    })
    return ok(quota, 201)
  }

  // Pending
  const quota = await prisma.memberQuota.create({ data: baseData })
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

// PATCH /api/clubs/[clubId]/accounting/quotas — edit quota status or fields
export async function PATCH(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = PatchQuotaSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const quota = await prisma.memberQuota.findFirst({
    where: { id: parsed.data.quotaId, clubId: params.clubId },
    include: { membership: { include: { user: { select: { id: true, name: true } } } } },
  })
  if (!quota) return err('Cuota no encontrada', 404)

  const now = new Date()

  switch (parsed.data.action) {
    case 'mark_paid': {
      if (quota.status === 'PAID') return err('La cuota ya está pagada', 409)
      const existing = await prisma.bankMovement.findUnique({
        where: { source_sourceId: { source: 'FEE', sourceId: quota.id } },
      })
      if (existing) return err('Ya existe un movimiento contable para esta cuota', 409)

      const [updatedQuota, movement] = await prisma.$transaction([
        prisma.memberQuota.update({ where: { id: quota.id }, data: { status: 'PAID', paidAt: now } }),
        prisma.bankMovement.create({
          data: {
            clubId: params.clubId,
            type: 'INCOME',
            amount: quota.amount,
            description: `Cuota ${quota.year} — ${quota.membership.user.name}`,
            source: 'FEE',
            sourceId: quota.id,
            categoryId: 'categoryId' in parsed.data ? (parsed.data.categoryId ?? null) : null,
            date: now,
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

    case 'mark_paid_historical': {
      if (quota.status === 'PAID') return err('La cuota ya está pagada', 409)
      const updatedQuota = await prisma.memberQuota.update({
        where: { id: quota.id },
        data: { status: 'PAID', paidAt: now },
      })
      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.QUOTA_PAID,
        entity: 'MemberQuota',
        entityId: quota.id,
        details: { member: quota.membership.user.name, year: quota.year, amount: Number(quota.amount), historical: true },
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
      return ok({ quota: updatedQuota })
    }

    case 'mark_pending': {
      if (quota.status === 'PENDING') return err('La cuota ya está pendiente', 409)
      // Refuse if a BankMovement exists — reverting would break accounting consistency
      const movement = await prisma.bankMovement.findUnique({
        where: { source_sourceId: { source: 'FEE', sourceId: quota.id } },
      })
      if (movement) return err('No se puede revertir: existe un movimiento contable asociado. Elimínalo desde Contabilidad primero.', 409)
      const updatedQuota = await prisma.memberQuota.update({
        where: { id: quota.id },
        data: { status: 'PENDING', paidAt: null },
      })
      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.QUOTA_CREATED,
        entity: 'MemberQuota',
        entityId: quota.id,
        details: { member: quota.membership.user.name, year: quota.year, reverted: true },
      })
      return ok({ quota: updatedQuota })
    }

    case 'mark_overdue': {
      if (quota.status !== 'PENDING') return err('Solo se pueden vencer cuotas pendientes', 409)
      const updatedQuota = await prisma.memberQuota.update({
        where: { id: quota.id },
        data: { status: 'OVERDUE' },
      })
      return ok({ quota: updatedQuota })
    }

    case 'edit': {
      if (quota.status === 'PAID') return err('No se puede editar una cuota ya pagada', 409)
      const updatedQuota = await prisma.memberQuota.update({
        where: { id: quota.id },
        data: {
          ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
          ...(parsed.data.dueDate !== undefined && {
            dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          }),
        },
      })
      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.QUOTA_CREATED,
        entity: 'MemberQuota',
        entityId: quota.id,
        details: { member: quota.membership.user.name, year: quota.year, edited: true },
      })
      return ok({ quota: updatedQuota })
    }
  }
}
