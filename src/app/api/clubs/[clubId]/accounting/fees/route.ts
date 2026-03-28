import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const BulkGenerateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  amount: z.number().positive(),
  dueDate: z.string().optional(), // ISO date
})

// POST /api/clubs/[clubId]/accounting/fees/generate
// Bulk-creates a MemberQuota for every APPROVED member that doesn't already have one for the given year.
// Idempotent: skips members who already have a quota for that year.
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = BulkGenerateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { year, amount, dueDate } = parsed.data

  // Load all approved memberships
  const memberships = await prisma.clubMembership.findMany({
    where: { clubId: params.clubId, status: 'APPROVED' },
    include: {
      user: { select: { id: true, name: true } },
      quotas: { where: { year }, select: { id: true } },
    },
  })

  // Filter to those without a quota for this year
  const toCreate = memberships.filter((m) => m.quotas.length === 0)

  if (toCreate.length === 0) {
    return ok({
      created: 0,
      skipped: memberships.length,
      message: `Todos los miembros ya tienen cuota asignada para ${year}`,
    })
  }

  // Bulk create with createMany (no relations needed)
  await prisma.memberQuota.createMany({
    data: toCreate.map((m) => ({
      membershipId: m.id,
      clubId: params.clubId,
      year,
      amount,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: 'PENDING',
    })),
    skipDuplicates: true,
  })

  // Notify each new member
  await prisma.notification.createMany({
    data: toCreate.map((m) => ({
      userId: m.user.id,
      clubId: params.clubId,
      title: `Cuota ${year} asignada`,
      message: `Se ha generado tu cuota anual ${year} por importe de ${amount.toFixed(2)}€.${dueDate ? ` Vence el ${new Date(dueDate).toLocaleDateString('es-ES')}.` : ''}`,
      link: '/socio/quotas',
    })),
    skipDuplicates: true,
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.FEE_BULK_GENERATED,
    entity: 'MemberQuota',
    details: { year, amount, membersCount: toCreate.length, skipped: memberships.length - toCreate.length },
  })

  return ok({
    created: toCreate.length,
    skipped: memberships.length - toCreate.length,
    message: `${toCreate.length} cuotas generadas para el año ${year}`,
  }, 201)
}
