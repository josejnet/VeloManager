import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

const UpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  pinned: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; announcementId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const updated = await prisma.clubAnnouncement.update({
    where: { id: params.announcementId },
    data: {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    },
    include: { sharedFiles: true },
  })

  return ok(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; announcementId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  await prisma.clubAnnouncement.delete({ where: { id: params.announcementId } })
  return ok({ success: true })
}
