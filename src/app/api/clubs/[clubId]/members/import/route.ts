import { NextRequest } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'

const MemberRowSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(1).optional(),
  province: z.string().optional(),
  locality: z.string().optional(),
})

const ImportBodySchema = z.object({
  members: z.array(MemberRowSchema).min(1).max(500),
})

// POST /api/clubs/[clubId]/members/import
// Bulk CSV import of members: upsert User by email, create ClubMembership if not exists
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const club = await prisma.club.findUnique({
    where: { id: params.clubId },
    select: { id: true },
  })
  if (!club) return err('Club no encontrado', 404)

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = ImportBodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { members } = parsed.data

  let imported = 0
  let skipped = 0
  const errors: { email: string; reason: string }[] = []

  for (const row of members) {
    try {
      // Upsert the user by email
      const hashedPassword = row.password ? await hash(row.password, 10) : undefined
      const user = await prisma.user.upsert({
        where: { email: row.email.toLowerCase() },
        create: {
          email: row.email.toLowerCase(),
          name: row.name,
          password: hashedPassword ?? null,
          province: row.province ?? null,
          locality: row.locality ?? null,
        },
        update: {
          // Only update location/password fields; do not overwrite name to preserve existing users
          ...(row.province !== undefined && { province: row.province }),
          ...(row.locality !== undefined && { locality: row.locality }),
          ...(hashedPassword !== undefined && { password: hashedPassword }),
        },
        select: { id: true },
      })

      // Check if membership already exists
      const existing = await prisma.clubMembership.findUnique({
        where: { userId_clubId: { userId: user.id, clubId: params.clubId } },
        select: { id: true, status: true },
      })

      if (existing) {
        skipped++
        continue
      }

      // Create approved membership
      await prisma.clubMembership.create({
        data: {
          userId: user.id,
          clubId: params.clubId,
          status: 'APPROVED',
          clubRole: 'MEMBER',
          joinedAt: new Date(),
        },
      })

      imported++
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error desconocido'
      errors.push({ email: row.email, reason: message })
    }
  }

  return ok({ imported, skipped, errors })
}
