import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

const UpdateMemberSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
  }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('suspend'),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('unsuspend'),
  }),
  z.object({
    action: z.literal('ban'),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('unban'),
  }),
  z.object({
    action: z.literal('change_role'),
    role: z.enum(['CLUB_ADMIN', 'SOCIO']),
  }),
])

// PATCH /api/clubs/[clubId]/members/[memberId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; memberId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = UpdateMemberSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const membership = await prisma.clubMembership.findFirst({
    where: { id: params.memberId, clubId: params.clubId },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!membership) return err('Miembro no encontrado', 404)

  // Prevent admin from modifying their own membership role/ban
  if (membership.userId === access.userId && parsed.data.action !== 'approve') {
    return err('No puedes modificar tu propia membresía')
  }

  const now = new Date()
  let updated

  switch (parsed.data.action) {
    case 'approve': {
      if (membership.status !== 'PENDING') return err('Solo se pueden aprobar solicitudes pendientes')

      // Check plan member limit
      const club = await prisma.club.findUnique({
        where: { id: params.clubId },
        include: { subscription: { select: { memberLimit: true } } },
      })
      const limit = club?.subscription?.memberLimit
      if (limit != null) {
        const count = await prisma.clubMembership.count({
          where: { clubId: params.clubId, status: 'APPROVED' },
        })
        if (count >= limit) return err('El club ha alcanzado su límite de miembros', 422)
      }

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: { status: 'APPROVED', joinedAt: now },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Solicitud aprobada',
          message: 'Tu solicitud de membresía ha sido aprobada. ¡Bienvenido!',
          link: '/socio',
        },
      })

      // Auto-link ClubMemberProfile if one exists with matching email
      const approvedUser = await prisma.user.findUnique({
        where: { id: membership.userId },
        select: { email: true },
      })
      if (approvedUser) {
        await prisma.clubMemberProfile.updateMany({
          where: {
            clubId: params.clubId,
            email: approvedUser.email,
            status: 'UNREGISTERED',
          },
          data: {
            status: 'LINKED',
            userId: membership.userId,
            membershipId: params.memberId,
          },
        })
      }

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.MEMBER_APPROVED,
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name },
      })
      break
    }

    case 'reject': {
      if (membership.status !== 'PENDING') return err('Solo se pueden rechazar solicitudes pendientes')

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: { status: 'REJECTED' },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Solicitud rechazada',
          message: parsed.data.reason
            ? `Tu solicitud ha sido rechazada. Motivo: ${parsed.data.reason}`
            : 'Tu solicitud de membresía ha sido rechazada.',
        },
      })

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.MEMBER_REJECTED,
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name, reason: parsed.data.reason },
      })
      break
    }

    case 'suspend': {
      if (membership.status !== 'APPROVED') return err('Solo se pueden suspender miembros activos')

      // Last-admin guard: cannot suspend the only admin
      if (membership.role === 'CLUB_ADMIN') {
        const adminCount = await prisma.clubMembership.count({
          where: { clubId: params.clubId, role: 'CLUB_ADMIN', status: 'APPROVED' },
        })
        if (adminCount <= 1) return err('No puedes suspender al único administrador del club', 409)
      }

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: { status: 'SUSPENDED' },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Membresía suspendida',
          message: parsed.data.reason
            ? `Tu membresía ha sido suspendida. Motivo: ${parsed.data.reason}`
            : 'Tu membresía ha sido suspendida. Contacta al administrador.',
        },
      })

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.MEMBER_SUSPENDED,
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name, reason: parsed.data.reason },
      })
      break
    }

    case 'unsuspend': {
      if (membership.status !== 'SUSPENDED') return err('El miembro no está suspendido')

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: { status: 'APPROVED' },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Suspensión levantada',
          message: 'Tu suspensión ha sido levantada. Ya puedes acceder al club.',
          link: '/socio',
        },
      })

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: 'MEMBER_UNSUSPENDED',
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name },
      })
      break
    }

    case 'ban': {
      if (membership.status === 'BANNED') return err('El miembro ya está baneado')

      // Last-admin guard: cannot ban the only admin
      if (membership.role === 'CLUB_ADMIN') {
        const adminCount = await prisma.clubMembership.count({
          where: { clubId: params.clubId, role: 'CLUB_ADMIN', status: 'APPROVED' },
        })
        if (adminCount <= 1) return err('No puedes banear al único administrador del club', 409)
      }

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: {
          status: 'BANNED',
          bannedAt: now,
          bannedById: access.userId,
          bannedReason: parsed.data.reason ?? null,
        },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Has sido expulsado del club',
          message: 'Tu acceso al club ha sido revocado permanentemente.',
        },
      })

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.MEMBER_BANNED,
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name, reason: parsed.data.reason },
      })
      break
    }

    case 'unban': {
      if (membership.status !== 'BANNED') return err('El miembro no está baneado')

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: {
          status: 'APPROVED',
          bannedAt: null,
          bannedById: null,
          bannedReason: null,
        },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Ban levantado',
          message: 'Tu acceso al club ha sido restaurado.',
          link: '/socio',
        },
      })

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.MEMBER_UNBANNED,
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name },
      })
      break
    }

    case 'change_role': {
      if (membership.status !== 'APPROVED') return err('Solo se puede cambiar el rol de miembros activos')

      // Last-admin guard: cannot demote the only admin
      if (membership.role === 'CLUB_ADMIN' && parsed.data.role === 'SOCIO') {
        const adminCount = await prisma.clubMembership.count({
          where: { clubId: params.clubId, role: 'CLUB_ADMIN', status: 'APPROVED' },
        })
        if (adminCount <= 1) return err('No puedes degradar al único administrador del club', 409)
      }

      updated = await prisma.clubMembership.update({
        where: { id: params.memberId },
        data: {
          role: parsed.data.role as UserRole,
          clubRole: parsed.data.role === 'CLUB_ADMIN' ? 'ADMIN' : 'MEMBER',
        },
      })

      await prisma.notification.create({
        data: {
          userId: membership.userId,
          clubId: params.clubId,
          title: 'Tu rol ha cambiado',
          message: `Tu nuevo rol en el club es: ${parsed.data.role === 'CLUB_ADMIN' ? 'Administrador' : 'Socio'}.`,
          link: '/socio',
        },
      })

      await writeAudit({
        clubId: params.clubId,
        userId: access.userId,
        action: AUDIT.MEMBER_ROLE_CHANGED,
        entity: 'Member',
        entityId: params.memberId,
        details: { targetUser: membership.user.name, newRole: parsed.data.role },
      })
      break
    }

    default:
      return err('Acción no válida')
  }

  return ok(updated)
}

// DELETE /api/clubs/[clubId]/members/[memberId] — soft-delete as LEFT
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; memberId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const membership = await prisma.clubMembership.findFirst({
    where: { id: params.memberId, clubId: params.clubId },
    include: { user: { select: { name: true } } },
  })
  if (!membership) return err('Miembro no encontrado', 404)
  if (membership.status === 'BANNED') return err('No puedes eliminar un miembro baneado. Usa "desbanear" primero si es necesario.')

  // Last-admin guard: cannot remove the only admin
  if (membership.role === 'CLUB_ADMIN') {
    const adminCount = await prisma.clubMembership.count({
      where: { clubId: params.clubId, role: 'CLUB_ADMIN', status: 'APPROVED' },
    })
    if (adminCount <= 1) return err('No puedes eliminar al único administrador del club', 409)
  }

  // Soft delete: mark as LEFT instead of hard delete to preserve history
  await prisma.clubMembership.update({
    where: { id: params.memberId },
    data: { status: 'LEFT', leftAt: new Date() },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'MEMBER_REMOVED',
    entity: 'Member',
    entityId: params.memberId,
    details: { targetUser: membership.user.name },
  })

  return ok({ success: true })
}
