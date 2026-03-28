import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'

// DELETE /api/clubs/[clubId]/events/[eventId]/attachments/[attachmentId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string; attachmentId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const attachment = await prisma.eventAttachment.findFirst({
    where: { id: params.attachmentId, eventId: params.eventId, clubId: params.clubId },
  })
  if (!attachment) return err('Adjunto no encontrado', 404)

  await prisma.eventAttachment.delete({ where: { id: params.attachmentId } })
  return ok({ success: true })
}
