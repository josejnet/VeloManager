import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

class InvitationError extends Error {
  constructor(
    public code:
      | 'INVALID_TOKEN'
      | 'REVOKED'
      | 'EXPIRED'
      | 'MAX_USES_REACHED'
      | 'BANNED'
      | 'ALREADY_MEMBER'
      | 'CLUB_FULL'
      | 'EMAIL_MISMATCH'
      | 'INVITE_ONLY_BYPASS',
    message: string
  ) {
    super(message)
  }
}

// POST /api/invite/[token]/accept
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const membership = await prisma.$transaction(async (tx) => {
      // 1. Lock the invitation row
      const inv = await tx.clubInvitation.findUnique({
        where: { token: params.token },
        include: {
          club: {
            select: {
              id: true,
              name: true,
              autoApprove: true,
              joinPolicy: true,
              subscription: { select: { memberLimit: true } },
            },
          },
        },
      })

      if (!inv) throw new InvitationError('INVALID_TOKEN', 'Invitación no válida')

      const now = new Date()

      if (inv.status === 'REVOKED') throw new InvitationError('REVOKED', 'Esta invitación ha sido cancelada')

      if (inv.status === 'EXPIRED' || (inv.expiresAt != null && inv.expiresAt < now)) {
        // Auto-mark as expired if not already
        if (inv.status === 'PENDING') {
          await tx.clubInvitation.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } })
        }
        throw new InvitationError('EXPIRED', 'Esta invitación ha expirado')
      }

      if (inv.maxUses != null && inv.usesCount >= inv.maxUses) {
        throw new InvitationError('MAX_USES_REACHED', 'Esta invitación ha alcanzado el límite de usos')
      }

      // 2. Verify email match for EMAIL invitations
      if (inv.invitedEmail != null) {
        const user = await tx.user.findUnique({
          where: { id: auth.userId },
          select: { email: true },
        })
        if (user?.email !== inv.invitedEmail) {
          throw new InvitationError(
            'EMAIL_MISMATCH',
            'Esta invitación es para otro email. Inicia sesión con la cuenta correcta.'
          )
        }
      }

      // 3. Check existing membership
      const existingMembership = await tx.clubMembership.findUnique({
        where: { userId_clubId: { userId: auth.userId, clubId: inv.clubId } },
      })

      if (existingMembership?.status === 'BANNED') {
        throw new InvitationError('BANNED', 'No puedes unirte a este club')
      }
      if (existingMembership?.status === 'APPROVED') {
        // Not really an error — just redirect them to the club
        throw new InvitationError('ALREADY_MEMBER', 'Ya eres miembro de este club')
      }

      // 4. Check plan member limit (only for invitations that auto-approve)
      const willApprove = inv.club.autoApprove || inv.club.joinPolicy === 'OPEN'
      if (willApprove) {
        const limit = inv.club.subscription?.memberLimit
        if (limit != null) {
          const memberCount = await tx.clubMembership.count({
            where: { clubId: inv.clubId, status: 'APPROVED' },
          })
          if (memberCount >= limit) {
            throw new InvitationError('CLUB_FULL', 'El club ha alcanzado su límite de miembros')
          }
        }
      }

      // 5. Increment usage count atomically
      const updatedInv = await tx.clubInvitation.update({
        where: { id: inv.id },
        data: {
          usesCount: { increment: 1 },
          acceptedAt: now,
          acceptedByUserId: auth.userId,
          // Mark as ACCEPTED if this was the last available use
          status:
            inv.maxUses != null && inv.usesCount + 1 >= inv.maxUses
              ? 'ACCEPTED'
              : inv.status,
        },
      })

      // 6. Upsert membership
      const membershipStatus = willApprove ? 'APPROVED' : 'PENDING'

      const newMembership = existingMembership
        ? await tx.clubMembership.update({
            where: { id: existingMembership.id },
            data: {
              status: membershipStatus,
              clubRole: inv.assignedRole,
              invitationId: inv.id,
              joinedAt: membershipStatus === 'APPROVED' ? now : undefined,
            },
          })
        : await tx.clubMembership.create({
            data: {
              userId: auth.userId,
              clubId: inv.clubId,
              status: membershipStatus,
              clubRole: inv.assignedRole,
              invitationId: inv.id,
              joinedAt: membershipStatus === 'APPROVED' ? now : undefined,
            },
          })

      // 7. Notify admin if pending approval
      if (membershipStatus === 'PENDING') {
        const user = await tx.user.findUnique({
          where: { id: auth.userId },
          select: { name: true },
        })
        const admins = await tx.clubMembership.findMany({
          where: { clubId: inv.clubId, status: 'APPROVED', clubRole: 'ADMIN' },
          select: { userId: true },
        })
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.userId,
              clubId: inv.clubId,
              title: 'Nueva solicitud de membresía',
              message: `${user?.name ?? 'Un usuario'} ha solicitado unirse al club mediante invitación.`,
              link: '/admin/members',
            })),
          })
        }
      }

      // 8. Notify the user if auto-approved
      if (membershipStatus === 'APPROVED') {
        await tx.notification.create({
          data: {
            userId: auth.userId,
            clubId: inv.clubId,
            title: `¡Bienvenido a ${inv.club.name}!`,
            message: 'Tu acceso ha sido activado. Ya puedes acceder al club.',
            link: '/socio',
          },
        })
      }

      return { membership: newMembership, club: inv.club, status: membershipStatus }
    })

    await writeAudit({
      clubId: membership.club.id,
      userId: auth.userId,
      action: AUDIT.INVITATION_ACCEPTED ?? 'INVITATION_ACCEPTED',
      entity: 'ClubInvitation',
      entityId: params.token,
      details: { membershipStatus: membership.status },
    })

    return ok({
      clubId: membership.club.id,
      clubName: membership.club.name,
      membershipStatus: membership.status,
      // Let the client decide where to redirect based on status
    })
  } catch (error) {
    if (error instanceof InvitationError) {
      const statusMap: Record<string, number> = {
        INVALID_TOKEN: 404,
        REVOKED: 410,
        EXPIRED: 410,
        MAX_USES_REACHED: 410,
        BANNED: 403,
        ALREADY_MEMBER: 409,
        CLUB_FULL: 422,
        EMAIL_MISMATCH: 403,
        INVITE_ONLY_BYPASS: 403,
      }
      return err(error.message, statusMap[error.code] ?? 400, error.code)
    }
    throw error
  }
}
