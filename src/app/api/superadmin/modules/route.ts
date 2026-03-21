import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

// GET /api/superadmin/modules
// Returns list of all PlatformModules from DB
export async function GET(_req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const modules = await prisma.platformModule.findMany({
    orderBy: { key: 'asc' },
    include: {
      _count: { select: { clubAccess: true } },
    },
  })

  return ok(modules)
}

const CreateModuleSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  icon: z.string().optional(),
  defaultForPlans: z.array(z.enum(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'])).optional(),
})

// POST /api/superadmin/modules
// Creates a new PlatformModule
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = CreateModuleSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { key, name, description, icon, defaultForPlans } = parsed.data

  const existing = await prisma.platformModule.findUnique({ where: { key } })
  if (existing) return err(`Ya existe un módulo con la clave '${key}'`, 409)

  const module = await prisma.platformModule.create({
    data: {
      key,
      name,
      description: description ?? null,
      icon: icon ?? null,
      includedInPlans: defaultForPlans ?? [],
    },
  })

  return ok(module, 201)
}
