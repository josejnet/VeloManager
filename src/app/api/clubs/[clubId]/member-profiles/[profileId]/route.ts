import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import { writeAudit } from '@/lib/audit'

const PatchProfileSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  jerseyNumber: z.string().max(20).nullable().optional(),
  licenseNumber: z.string().max(50).nullable().optional(),
  joinDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const profileIncludes = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  membership: { select: { id: true, status: true, role: true } },
} as const

// GET /api/clubs/[clubId]/member-profiles/[profileId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; profileId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const profile = await prisma.clubMemberProfile.findFirst({
    where: { id: params.profileId, clubId: params.clubId },
    include: profileIncludes,
  })
  if (!profile) return err('Perfil no encontrado', 404)

  return ok(profile)
}

// PATCH /api/clubs/[clubId]/member-profiles/[profileId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; profileId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const profile = await prisma.clubMemberProfile.findFirst({
    where: { id: params.profileId, clubId: params.clubId },
  })
  if (!profile) return err('Perfil no encontrado', 404)

  const body = await req.json().catch(() => null)
  const parsed = PatchProfileSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const d = parsed.data

  // Prevent email changes on linked profiles
  if (d.email !== undefined && profile.userId) {
    return err('El correo no es editable mientras el perfil está vinculado a un usuario', 422)
  }

  // If email is being changed, check for duplicates
  if (d.email && d.email.toLowerCase() !== profile.email) {
    const dup = await prisma.clubMemberProfile.findUnique({
      where: { clubId_email: { clubId: params.clubId, email: d.email.toLowerCase() } },
    })
    if (dup) return err('Ya existe un perfil con ese email en este club', 409)
  }

  const updateData: Record<string, unknown> = {}
  if (d.email !== undefined) updateData.email = d.email.toLowerCase()
  if (d.firstName !== undefined) updateData.firstName = d.firstName
  if (d.lastName !== undefined) updateData.lastName = d.lastName
  if (d.phone !== undefined) updateData.phone = d.phone
  if (d.address !== undefined) updateData.address = d.address
  if (d.city !== undefined) updateData.city = d.city
  if (d.postalCode !== undefined) updateData.postalCode = d.postalCode
  if (d.birthDate !== undefined) updateData.birthDate = d.birthDate ? new Date(d.birthDate) : null
  if (d.jerseyNumber !== undefined) updateData.jerseyNumber = d.jerseyNumber
  if (d.licenseNumber !== undefined) updateData.licenseNumber = d.licenseNumber
  if (d.joinDate !== undefined) updateData.joinDate = d.joinDate ? new Date(d.joinDate) : null
  if (d.notes !== undefined) updateData.notes = d.notes

  const updated = await prisma.clubMemberProfile.update({
    where: { id: params.profileId },
    data: updateData,
    include: profileIncludes,
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'MEMBER_PROFILE_UPDATED',
    entity: 'ClubMemberProfile',
    entityId: params.profileId,
    details: updateData,
  })

  return ok(updated)
}

// DELETE /api/clubs/[clubId]/member-profiles/[profileId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; profileId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const profile = await prisma.clubMemberProfile.findFirst({
    where: { id: params.profileId, clubId: params.clubId },
  })
  if (!profile) return err('Perfil no encontrado', 404)

  if (profile.status === 'LINKED') {
    return err('No puedes eliminar un perfil vinculado a un usuario activo', 409)
  }

  await prisma.clubMemberProfile.delete({ where: { id: params.profileId } })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'MEMBER_PROFILE_DELETED',
    entity: 'ClubMemberProfile',
    entityId: params.profileId,
    details: { email: profile.email },
  })

  return ok({ success: true })
}
