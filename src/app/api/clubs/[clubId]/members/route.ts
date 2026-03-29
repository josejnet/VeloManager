import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess, requireAuth } from '@/lib/authz'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import type { MembershipStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET /api/clubs/[clubId]/members
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = (req.nextUrl.searchParams.get('status') ?? 'APPROVED') as MembershipStatus
  const sortParam = req.nextUrl.searchParams.get('sort') ?? 'joinedAt'
  const orderParam = (req.nextUrl.searchParams.get('order') ?? 'desc') as 'asc' | 'desc'

  const ALLOWED_SORTS = ['joinedAt', 'clubRole', 'createdAt']
  const sort = ALLOWED_SORTS.includes(sortParam) ? sortParam : 'joinedAt'
  const orderBy: Record<string, 'asc' | 'desc'> | { user: Record<string, 'asc' | 'desc'> } =
    sortParam === 'name'  ? { user: { name: orderParam } } :
    sortParam === 'email' ? { user: { email: orderParam } } :
    { [sort]: orderParam }

  const where = { clubId: params.clubId, status }

  const [memberships, total] = await Promise.all([
    prisma.clubMembership.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true } },
        quotas: { orderBy: { year: 'desc' } },
        invitation: { select: { id: true, channel: true, invitedEmail: true } },
      },
    }),
    prisma.clubMembership.count({ where }),
  ])

  return ok(buildPaginatedResponse(memberships, total, page, pageSize))
}

// POST /api/clubs/[clubId]/members — request to join a club
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const club = await prisma.club.findUnique({
    where: { id: params.clubId },
    select: {
      id: true,
      name: true,
      visibility: true,
      joinPolicy: true,
      autoApprove: true,
      subscription: { select: { memberLimit: true } },
    },
  })

  // For HIDDEN clubs return 404 — never reveal existence
  if (!club || club.visibility === 'HIDDEN') return err('Club no encontrado', 404)

  if (club.joinPolicy === 'INVITE_ONLY') {
    return err('Este club solo acepta miembros por invitación', 403)
  }

  const existing = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId: auth.userId, clubId: params.clubId } },
  })

  if (existing) {
    if (existing.status === 'APPROVED') return err('Ya eres miembro de este club', 409)
    if (existing.status === 'PENDING') return err('Tu solicitud ya está pendiente de aprobación', 409)
    if (existing.status === 'BANNED') return err('No puedes unirte a este club', 403)
    if (existing.status === 'SUSPENDED') return err('Tu membresía está suspendida. Contacta al administrador', 403)

    if (existing.status === 'REJECTED') {
      // Enforce 7-day cooldown after rejection
      const cooldownMs = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - existing.updatedAt.getTime() < cooldownMs) {
        const retryAfter = new Date(existing.updatedAt.getTime() + cooldownMs)
        return err(
          `Debes esperar hasta el ${retryAfter.toLocaleDateString('es-ES')} para volver a solicitar acceso`,
          429
        )
      }
    }
    // LEFT status: allow rejoin
  }

  const willApprove = club.joinPolicy === 'OPEN' && club.autoApprove

  if (willApprove) {
    const limit = club.subscription?.memberLimit
    if (limit != null) {
      const count = await prisma.clubMembership.count({
        where: { clubId: params.clubId, status: 'APPROVED' },
      })
      if (count >= limit) return err('El club ha alcanzado su límite de miembros', 422)
    }
  }

  const membershipStatus = willApprove ? 'APPROVED' : 'PENDING'

  const membership = existing
    ? await prisma.clubMembership.update({
        where: { id: existing.id },
        data: { status: membershipStatus, joinedAt: willApprove ? new Date() : undefined },
      })
    : await prisma.clubMembership.create({
        data: {
          userId: auth.userId,
          clubId: params.clubId,
          status: membershipStatus,
          clubRole: 'MEMBER',
          joinedAt: willApprove ? new Date() : undefined,
        },
      })

  if (membershipStatus === 'PENDING') {
    await notifyAdmins(params.clubId, auth.userId, club.name)
  } else {
    await prisma.notification.create({
      data: {
        userId: auth.userId,
        clubId: params.clubId,
        title: `¡Bienvenido a ${club.name}!`,
        message: 'Tu acceso ha sido activado automáticamente.',
        link: '/socio',
      },
    })
  }

  return ok(membership, 201)
}

async function notifyAdmins(clubId: string, applicantId: string, clubName: string) {
  const [applicant, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: applicantId }, select: { name: true } }),
    prisma.clubMembership.findMany({
      where: { clubId, status: 'APPROVED', clubRole: 'ADMIN' },
      select: { userId: true },
    }),
  ])

  if (admins.length === 0) return

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.userId,
      clubId,
      title: 'Nueva solicitud de membresía',
      message: `${applicant?.name ?? 'Un usuario'} ha solicitado unirse a ${clubName}.`,
      link: '/admin/members',
    })),
  })
}
