import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/invite/[token] — public: fetch invitation details without accepting
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const invitation = await prisma.clubInvitation.findUnique({
    where: { token: params.token },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          sport: true,
          logoUrl: true,
          colorTheme: true,
          // Do NOT expose visibility/joinPolicy/internal config to public
        },
      },
    },
  })

  // Always return 404 for invalid tokens — never reveal why (prevents enumeration)
  if (!invitation) return err('Invitación no encontrada', 404)

  // Compute effective status
  const now = new Date()
  const isExpired = invitation.expiresAt != null && invitation.expiresAt < now
  const isExhausted = invitation.maxUses != null && invitation.usesCount >= invitation.maxUses

  if (invitation.status === 'REVOKED') return err('Esta invitación ha sido cancelada', 410)
  if (invitation.status === 'ACCEPTED' && invitation.maxUses === 1) return err('Esta invitación ya ha sido utilizada', 410)
  if (isExpired || invitation.status === 'EXPIRED') return err('Esta invitación ha expirado', 410)
  if (isExhausted) return err('Esta invitación ha alcanzado el límite de usos', 410)

  // Return minimal public info — never expose internal fields like note, revokedById, etc.
  return ok({
    clubId: invitation.clubId,
    clubName: invitation.club.name,
    clubSport: invitation.club.sport,
    clubLogoUrl: invitation.club.logoUrl,
    clubColorTheme: invitation.club.colorTheme,
    channel: invitation.channel,
    assignedRole: invitation.assignedRole,
    expiresAt: invitation.expiresAt,
    usesCount: invitation.usesCount,
    maxUses: invitation.maxUses,
    // For email invitations, expose only whether email restriction exists (not the email itself)
    requiresEmailMatch: invitation.invitedEmail != null,
  })
}
