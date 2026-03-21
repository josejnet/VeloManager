import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

const UpdateModuleSchema = z.object({
  key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  defaultForPlans: z.array(z.enum(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'])).optional(),
  stable: z.boolean().optional(),
})

// PATCH /api/superadmin/modules/[moduleId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = UpdateModuleSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const existing = await prisma.platformModule.findUnique({
    where: { id: params.moduleId },
  })
  if (!existing) return err('Módulo no encontrado', 404)

  // If key is changing, check for conflicts
  if (parsed.data.key && parsed.data.key !== existing.key) {
    const conflict = await prisma.platformModule.findUnique({
      where: { key: parsed.data.key },
    })
    if (conflict) return err(`Ya existe un módulo con la clave '${parsed.data.key}'`, 409)
  }

  const { defaultForPlans, ...rest } = parsed.data

  const updated = await prisma.platformModule.update({
    where: { id: params.moduleId },
    data: {
      ...rest,
      ...(defaultForPlans !== undefined && { includedInPlans: defaultForPlans }),
    },
  })

  return ok(updated)
}

// DELETE /api/superadmin/modules/[moduleId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const existing = await prisma.platformModule.findUnique({
    where: { id: params.moduleId },
  })
  if (!existing) return err('Módulo no encontrado', 404)

  await prisma.platformModule.delete({ where: { id: params.moduleId } })

  return ok({ success: true })
}
