import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const UpdateWindowSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED']),
})

// PATCH /api/clubs/[clubId]/purchases/windows/[windowId] — open or close
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; windowId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateWindowSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const window = await prisma.purchaseWindow.findFirst({
    where: { id: params.windowId, clubId: params.clubId },
  })
  if (!window) return err('Ventana de compra no encontrada', 404)

  const updated = await prisma.purchaseWindow.update({
    where: { id: params.windowId },
    data: {
      status: parsed.data.status,
      openedAt: parsed.data.status === 'OPEN' ? new Date() : undefined,
      closedAt: parsed.data.status === 'CLOSED' ? new Date() : undefined,
    },
  })

  const action = parsed.data.status === 'OPEN' ? AUDIT.WINDOW_OPENED : AUDIT.WINDOW_CLOSED
  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action,
    entity: 'PurchaseWindow',
    entityId: params.windowId,
    details: { name: window.name, status: parsed.data.status },
  })

  // Notify all members when window opens
  if (parsed.data.status === 'OPEN') {
    const members = await prisma.clubMembership.findMany({
      where: { clubId: params.clubId, status: 'APPROVED', clubRole: 'MEMBER' },
      select: { userId: true },
    })
    if (members.length > 0) {
      await prisma.notification.createMany({
        data: members.map((m) => ({
          userId: m.userId,
          clubId: params.clubId,
          title: 'Nueva campaña de compra abierta',
          message: `La campaña "${window.name}" está abierta. ¡Haz tu pedido ahora!`,
          link: '/socio/purchases',
        })),
      })
    }
  }

  return ok(updated)
}
