import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateQuotaSchema = z.object({
  membershipId: z.string(),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().positive(),
})

const PayQuotaSchema = z.object({
  quotaId: z.string(),
})

// GET /api/clubs/[clubId]/accounting/quotas
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = req.nextUrl.searchParams.get('status')
  const year = req.nextUrl.searchParams.get('year')

  const where = {
    clubId: params.clubId,
    ...(status ? { status: status as 'PENDING' | 'PAID' | 'OVERDUE' } : {}),
    ...(year ? { year: parseInt(year) } : {}),
  }

  const [quotas, total] = await Promise.all([
    prisma.memberQuota.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
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
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateQuotaSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  // Verify membership belongs to this club
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

// PATCH /api/clubs/[clubId]/accounting/quotas — mark quota as paid
export async function PATCH(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = PayQuotaSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const quota = await prisma.memberQuota.findFirst({
    where: { id: parsed.data.quotaId, clubId: params.clubId },
    include: {
      membership: { include: { user: { select: { name: true } } } },
    },
  })
  if (!quota) return err('Cuota no encontrada', 404)
  if (quota.status === 'PAID') return err('La cuota ya está pagada', 409)

  const bankAccount = await prisma.bankAccount.findUnique({ where: { clubId: params.clubId } })
  if (!bankAccount) return err('Cuenta bancaria no encontrada', 404)

  // Mark paid + create income transaction in a single DB transaction
  const [updatedQuota, transaction] = await prisma.$transaction([
    prisma.memberQuota.update({
      where: { id: quota.id },
      data: { status: 'PAID', paidAt: new Date() },
    }),
    prisma.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        clubId: params.clubId,
        type: 'INCOME',
        amount: quota.amount,
        description: `Cuota ${quota.year} — ${quota.membership.user.name}`,
        date: new Date(),
        quotaId: quota.id,
      },
    }),
    prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: { balance: { increment: quota.amount } },
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

  // Notify the member
  await prisma.notification.create({
    data: {
      userId: quota.membership.userId,
      clubId: params.clubId,
      title: `Cuota ${quota.year} registrada`,
      message: `Tu cuota anual ${quota.year} de ${quota.amount}€ ha sido registrada como pagada.`,
    },
  })

  return ok({ quota: updatedQuota, transaction })
}
