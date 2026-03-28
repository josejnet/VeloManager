import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateClubSchema = z.object({
  name: z.string().min(2).max(100),
  slogan: z.string().max(200).optional(),
  sport: z.string().min(1),
  colorTheme: z.string().default('blue'),
  logoUrl: z.string().url().optional(),
})

// GET /api/clubs — list clubs the current user belongs to
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)

  if (auth.platformRole === 'SUPER_ADMIN') {
    // Super Admin sees all clubs
    const [clubs, total] = await Promise.all([
      prisma.club.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          bankAccount: true,
          _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
        },
      }),
      prisma.club.count(),
    ])
    return ok(buildPaginatedResponse(clubs, total, page, pageSize))
  }

  // Read preferred club from cookie to return it first (used by client pages)
  const cookieHeader = req.headers.get('cookie') ?? ''
  const activeClubIdMatch = cookieHeader.match(/(?:^|;\s*)activeClubId=([^;]+)/)
  const activeClubId = activeClubIdMatch?.[1] ?? null

  const where = { userId: auth.userId, status: 'APPROVED' } as const
  const includeClub = {
    club: {
      include: {
        bankAccount: true,
        _count: { select: { memberships: { where: { status: 'APPROVED' as const } } } },
      },
    },
  } as const

  const [memberships, total] = await Promise.all([
    prisma.clubMembership.findMany({ where, skip, take, include: includeClub }),
    prisma.clubMembership.count({ where }),
  ])

  // Sort: active club first, then the rest by joinedAt
  const sorted = activeClubId
    ? [
        ...memberships.filter((m) => m.club.id === activeClubId),
        ...memberships.filter((m) => m.club.id !== activeClubId),
      ]
    : memberships

  const clubs = sorted.map((m) => ({ ...m.club, myRole: m.role }))
  return ok(buildPaginatedResponse(clubs, total, page, pageSize))
}

// POST /api/clubs — create a club (any authenticated user becomes its admin)
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = CreateClubSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const club = await prisma.$transaction(async (tx) => {
    const newClub = await tx.club.create({ data: parsed.data })

    // Creator becomes CLUB_ADMIN with approved membership
    await tx.clubMembership.create({
      data: {
        userId: auth.userId,
        clubId: newClub.id,
        role: 'CLUB_ADMIN',
        status: 'APPROVED',
        joinedAt: new Date(),
      },
    })

    // Create default bank account
    await tx.bankAccount.create({ data: { clubId: newClub.id } })

    // Default ledger categories
    await tx.ledgerCategory.createMany({
      data: [
        { clubId: newClub.id, name: 'Cuotas',            type: 'INCOME' },
        { clubId: newClub.id, name: 'Patrocinios',       type: 'INCOME' },
        { clubId: newClub.id, name: 'Subvenciones',      type: 'INCOME' },
        { clubId: newClub.id, name: 'Donaciones',        type: 'INCOME' },
        { clubId: newClub.id, name: 'Material deportivo',type: 'EXPENSE' },
        { clubId: newClub.id, name: 'Instalaciones',     type: 'EXPENSE' },
        { clubId: newClub.id, name: 'Transporte',        type: 'EXPENSE' },
        { clubId: newClub.id, name: 'Seguros',           type: 'EXPENSE' },
        { clubId: newClub.id, name: 'Administración',    type: 'EXPENSE' },
      ],
    })

    // Default size groups
    await tx.sizeGroup.createMany({
      data: [
        { clubId: newClub.id, name: 'Tallas ropa', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
        { clubId: newClub.id, name: 'Tallas calzado', sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] },
        { clubId: newClub.id, name: 'Unitalla', sizes: ['Única'] },
      ],
    })

    return newClub
  })

  return ok(club, 201)
}
