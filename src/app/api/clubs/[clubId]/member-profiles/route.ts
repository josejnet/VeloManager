import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import { writeAudit } from '@/lib/audit'

const CreateProfileSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().min(1, 'Los apellidos son obligatorios').max(100),
  phone: z.string().max(30).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  birthDate: z.string().optional(),
  jerseyNumber: z.string().max(20).optional(),
  licenseNumber: z.string().max(50).optional(),
  joinDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

// GET /api/clubs/[clubId]/member-profiles
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const statusFilter = req.nextUrl.searchParams.get('status')

  const where: Record<string, unknown> = {
    clubId: params.clubId,
    ...(statusFilter === 'UNREGISTERED' || statusFilter === 'LINKED'
      ? { status: statusFilter }
      : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { licenseNumber: { contains: q, mode: 'insensitive' } },
            { jerseyNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [profiles, total] = await Promise.all([
    prisma.clubMemberProfile.findMany({
      where,
      skip,
      take,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        membership: { select: { id: true, status: true, clubRole: true } },
      },
    }),
    prisma.clubMemberProfile.count({ where }),
  ])

  return ok(buildPaginatedResponse(profiles, total, page, pageSize))
}

// POST /api/clubs/[clubId]/member-profiles
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateProfileSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const d = parsed.data

  // Check for duplicate email in club
  const existing = await prisma.clubMemberProfile.findUnique({
    where: { clubId_email: { clubId: params.clubId, email: d.email.toLowerCase() } },
  })
  if (existing) return err('Ya existe un perfil con ese email en este club', 409)

  // Auto-link: check if a User with this email exists AND has an approved membership
  let userId: string | null = null
  let membershipId: string | null = null
  let status: 'UNREGISTERED' | 'LINKED' = 'UNREGISTERED'

  const matchedUser = await prisma.user.findUnique({
    where: { email: d.email.toLowerCase() },
    select: { id: true },
  })
  if (matchedUser) {
    const membership = await prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId: matchedUser.id, clubId: params.clubId } },
      select: { id: true, status: true },
    })
    if (membership && membership.status === 'APPROVED') {
      userId = matchedUser.id
      membershipId = membership.id
      status = 'LINKED'
    }
  }

  const profile = await prisma.clubMemberProfile.create({
    data: {
      clubId: params.clubId,
      email: d.email.toLowerCase(),
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone ?? null,
      address: d.address ?? null,
      city: d.city ?? null,
      postalCode: d.postalCode ?? null,
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      jerseyNumber: d.jerseyNumber ?? null,
      licenseNumber: d.licenseNumber ?? null,
      joinDate: d.joinDate ? new Date(d.joinDate) : null,
      notes: d.notes ?? null,
      status,
      userId,
      membershipId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      membership: { select: { id: true, status: true, clubRole: true } },
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'MEMBER_PROFILE_CREATED',
    entity: 'ClubMemberProfile',
    entityId: profile.id,
    details: { email: profile.email, status: profile.status },
  })

  return ok(profile, 201)
}
