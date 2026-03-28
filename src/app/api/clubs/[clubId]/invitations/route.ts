import { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { sendEmail } from '@/lib/email'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import type { InvitationChannel, ClubRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

const CreateInvitationSchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('EMAIL'),
    invitedEmail: z.string().email('Email inválido').toLowerCase(),
    assignedRole: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    expiresInDays: z.number().int().min(1).max(30).optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    channel: z.literal('LINK'),
    assignedRole: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    maxUses: z.number().int().min(1).max(10000).nullable().optional(),
    expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    channel: z.literal('CODE'),
    assignedRole: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    maxUses: z.number().int().min(1).max(10000).nullable().optional(),
    expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
    note: z.string().max(500).optional(),
  }),
])

// GET /api/clubs/[clubId]/invitations
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const channel = req.nextUrl.searchParams.get('channel') ?? undefined

  const where = {
    clubId: params.clubId,
    ...(status ? { status: status as never } : {}),
    ...(channel ? { channel: channel as InvitationChannel } : {}),
  }

  const [invitations, total] = await Promise.all([
    prisma.clubInvitation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, name: true } },
        acceptedBy: { select: { id: true, name: true } },
        invitedUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.clubInvitation.count({ where }),
  ])

  return ok(buildPaginatedResponse(invitations, total, page, pageSize))
}

// POST /api/clubs/[clubId]/invitations
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = CreateInvitationSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const club = await prisma.club.findUnique({
    where: { id: params.clubId },
    select: {
      name: true,
      inviteLinksEnabled: true,
      defaultInviteExpiryDays: true,
      defaultInviteMaxUses: true,
    },
  })
  if (!club) return err('Club no encontrado', 404)

  if (parsed.data.channel !== 'EMAIL' && !club.inviteLinksEnabled) {
    return err('Los enlaces de invitación están desactivados en este club', 403)
  }

  // Prevent admin from inviting themselves with escalated role
  if (parsed.data.channel === 'EMAIL') {
    const invitingUser = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { email: true },
    })
    if (invitingUser?.email === parsed.data.invitedEmail) {
      return err('No puedes invitarte a ti mismo')
    }
  }

  // For email invitations: check if a pending invitation already exists for that email
  if (parsed.data.channel === 'EMAIL') {
    const existing = await prisma.clubInvitation.findFirst({
      where: {
        clubId: params.clubId,
        invitedEmail: parsed.data.invitedEmail,
        status: 'PENDING',
      },
    })
    if (existing) {
      return err('Ya existe una invitación pendiente para ese email')
    }

    // Check if that email already belongs to a member of this club
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.invitedEmail },
      select: { id: true },
    })
    if (existingUser) {
      const membership = await prisma.clubMembership.findUnique({
        where: { userId_clubId: { userId: existingUser.id, clubId: params.clubId } },
      })
      if (membership?.status === 'APPROVED') {
        return err('Ese usuario ya es miembro del club')
      }
      if (membership?.status === 'BANNED') {
        return err('Ese usuario está baneado de este club')
      }
    }
  }

  const token = crypto.randomBytes(32).toString('hex')

  const expiryDays =
    'expiresInDays' in parsed.data && parsed.data.expiresInDays != null
      ? parsed.data.expiresInDays
      : club.defaultInviteExpiryDays

  const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 86_400_000) : null

  const maxUses =
    parsed.data.channel === 'EMAIL'
      ? 1
      : ('maxUses' in parsed.data && parsed.data.maxUses != null)
      ? parsed.data.maxUses
      : (club.defaultInviteMaxUses ?? 1)

  // Resolve existing user for email invitations
  let invitedUserId: string | null = null
  if (parsed.data.channel === 'EMAIL') {
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.invitedEmail },
      select: { id: true },
    })
    invitedUserId = existingUser?.id ?? null
  }

  const invitation = await prisma.clubInvitation.create({
    data: {
      clubId: params.clubId,
      invitedById: access.userId,
      invitedEmail: parsed.data.channel === 'EMAIL' ? parsed.data.invitedEmail : null,
      invitedUserId,
      token,
      channel: parsed.data.channel as InvitationChannel,
      assignedRole: parsed.data.assignedRole as ClubRole,
      maxUses,
      expiresAt,
      note: 'note' in parsed.data ? (parsed.data.note ?? null) : null,
    },
  })

  // Send email if channel is EMAIL
  if (parsed.data.channel === 'EMAIL') {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const acceptUrl = `${baseUrl}/invite/${token}`
    const expiryText = expiresAt
      ? `Este enlace expira el ${expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : ''

    await sendEmail({
      to: parsed.data.invitedEmail,
      subject: `Invitación para unirte a ${club.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #2563eb;">Invitación a ${club.name}</h2>
          <p>Has sido invitado a unirte a <strong>${club.name}</strong> en VeloManager.</p>
          <p style="margin: 32px 0;">
            <a href="${acceptUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Aceptar invitación
            </a>
          </p>
          <p style="color: #888; font-size: 13px;">${expiryText} Si no esperabas esta invitación, puedes ignorar este correo.</p>
          <p style="color: #aaa; font-size: 12px;">VeloManager · Gestión de clubs deportivos</p>
        </div>
      `,
    })
  }

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.INVITATION_CREATED ?? 'INVITATION_CREATED',
    entity: 'ClubInvitation',
    entityId: invitation.id,
    details: { channel: parsed.data.channel, invitedEmail: 'invitedEmail' in parsed.data ? parsed.data.invitedEmail : null },
  })

  return ok(invitation, 201)
}
