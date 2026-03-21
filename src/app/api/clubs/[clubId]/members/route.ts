import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess, requireAuth } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import type { MembershipStatus } from '@prisma/client'

// GET /api/clubs/[clubId]/members
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const status = (req.nextUrl.searchParams.get('status') ?? 'APPROVED') as MembershipStatus

  const where = { clubId: params.clubId, status }

  const [memberships, total] = await Promise.all([
    prisma.clubMembership.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true } },
        quotas: { orderBy: { year: 'desc' } },
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

  const club = await prisma.club.findUnique({ where: { id: params.clubId } })
  if (!club) return err('Club no encontrado', 404)

  const existing = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId: auth.userId, clubId: params.clubId } },
  })

  if (existing) {
    if (existing.status === 'APPROVED') return err('Ya eres miembro de este club', 409)
    if (existing.status === 'PENDING') return err('Tu solicitud ya está pendiente de aprobación', 409)
    if (existing.status === 'REJECTED') {
      // Allow re-application
      const updated = await prisma.clubMembership.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      })
      // Notify admins
      await notifyAdmins(params.clubId, auth.userId, club.name)
      return ok(updated)
    }
  }

  const membership = await prisma.clubMembership.create({
    data: {
      userId: auth.userId,
      clubId: params.clubId,
      status: 'PENDING',
      role: 'SOCIO',
    },
  })

  await notifyAdmins(params.clubId, auth.userId, club.name)

  return ok(membership, 201)
}

async function notifyAdmins(clubId: string, applicantId: string, clubName: string) {
  const applicant = await prisma.user.findUnique({
    where: { id: applicantId },
    select: { name: true },
  })

  const admins = await prisma.clubMembership.findMany({
    where: { clubId, status: 'APPROVED', role: 'CLUB_ADMIN' },
    select: { userId: true },
  })

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
