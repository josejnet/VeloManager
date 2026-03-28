import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok, err } from '@/lib/utils'

const PatchSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
})

// GET /api/superadmin/config
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.platformRole !== 'SUPER_ADMIN') return err('Acceso denegado', 403)

  const config = await prisma.platformConfig.findUnique({
    where: { id: 'singleton' },
  })

  // Return defaults if row doesn't exist yet
  return ok(config ?? { id: 'singleton', emailNotificationsEnabled: false })
}

// PATCH /api/superadmin/config
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.platformRole !== 'SUPER_ADMIN') return err('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const config = await prisma.platformConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...parsed.data },
    update: parsed.data,
  })

  return ok(config)
}
