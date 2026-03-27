import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { sendEmail } from '@/lib/email'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// DELETE /api/clubs/[clubId]/invitations/[invitationId] — revoke
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; invitationId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const invitation = await prisma.clubInvitation.findFirst({
    where: { id: params.invitationId, clubId: params.clubId },
  })
  if (!invitation) return err('Invitación no encontrada', 404)
  if (invitation.status !== 'PENDING') {
    return err(`No se puede revocar una invitación en estado "${invitation.status}"`)
  }

  await prisma.clubInvitation.update({
    where: { id: invitation.id },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedById: access.userId,
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.INVITATION_REVOKED ?? 'INVITATION_REVOKED',
    entity: 'ClubInvitation',
    entityId: invitation.id,
    details: { channel: invitation.channel, invitedEmail: invitation.invitedEmail },
  })

  return ok({ success: true })
}

// POST /api/clubs/[clubId]/invitations/[invitationId]/resend — resend email
// (handled as a sub-route below via PATCH action=resend)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; invitationId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  if (body.action !== 'resend') return err('Acción no válida')

  const invitation = await prisma.clubInvitation.findFirst({
    where: { id: params.invitationId, clubId: params.clubId },
    include: { club: { select: { name: true } } },
  })
  if (!invitation) return err('Invitación no encontrada', 404)
  if (invitation.channel !== 'EMAIL') return err('Solo se pueden reenviar invitaciones por email')
  if (invitation.status !== 'PENDING') return err('Solo se pueden reenviar invitaciones pendientes')
  if (!invitation.invitedEmail) return err('Esta invitación no tiene email asociado')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const acceptUrl = `${baseUrl}/invite/${invitation.token}`
  const expiryText = invitation.expiresAt
    ? `Este enlace expira el ${invitation.expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : ''

  await sendEmail({
    to: invitation.invitedEmail,
    subject: `Recordatorio: Invitación para unirte a ${invitation.club.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #2563eb;">Recordatorio: Invitación a ${invitation.club.name}</h2>
        <p>Tienes una invitación pendiente para unirte a <strong>${invitation.club.name}</strong> en VeloManager.</p>
        <p style="margin: 32px 0;">
          <a href="${acceptUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Aceptar invitación
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">${expiryText} Si no esperabas esta invitación, puedes ignorar este correo.</p>
      </div>
    `,
  })

  return ok({ success: true })
}
