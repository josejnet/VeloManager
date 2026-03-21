import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'
import type { MembershipStatus } from '@prisma/client'

const UpdateMemberSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
})

// PATCH /api/clubs/[clubId]/members/[memberId] — approve/reject/suspend
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; memberId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateMemberSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const membership = await prisma.clubMembership.findFirst({
    where: { id: params.memberId, clubId: params.clubId },
    include: { user: { select: { name: true } } },
  })
  if (!membership) return err('Miembro no encontrado', 404)

  const updated = await prisma.clubMembership.update({
    where: { id: params.memberId },
    data: {
      status: parsed.data.status,
      joinedAt: parsed.data.status === 'APPROVED' ? new Date() : undefined,
    },
  })

  const actionMap: Record<string, string> = {
    APPROVED: AUDIT.MEMBER_APPROVED,
    REJECTED: AUDIT.MEMBER_REJECTED,
    SUSPENDED: AUDIT.MEMBER_SUSPENDED,
  }

  if (parsed.data.status) {
    await writeAudit({
      clubId: params.clubId,
      userId: access.userId,
      action: actionMap[parsed.data.status] ?? 'MEMBER_STATUS_CHANGED',
      entity: 'Member',
      entityId: params.memberId,
      details: { targetUser: membership.user.name, status: parsed.data.status },
    })

    // Notify the member
    await prisma.notification.create({
      data: {
        userId: membership.userId,
        clubId: params.clubId,
        title:
          parsed.data.status === 'APPROVED'
            ? 'Solicitud aprobada'
            : parsed.data.status === 'REJECTED'
            ? 'Solicitud rechazada'
            : 'Cuenta suspendida',
        message:
          parsed.data.status === 'APPROVED'
            ? 'Tu solicitud de membresía ha sido aprobada. ¡Bienvenido!'
            : parsed.data.status === 'REJECTED'
            ? 'Tu solicitud de membresía ha sido rechazada.'
            : 'Tu membresía ha sido suspendida. Contacta al administrador.',
      },
    })
  }

  return ok(updated)
}

// DELETE /api/clubs/[clubId]/members/[memberId] — remove member
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; memberId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const membership = await prisma.clubMembership.findFirst({
    where: { id: params.memberId, clubId: params.clubId },
  })
  if (!membership) return err('Miembro no encontrado', 404)

  await prisma.clubMembership.delete({ where: { id: params.memberId } })

  return ok({ success: true })
}
