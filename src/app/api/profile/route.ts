import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import bcrypt from 'bcryptjs'

const PatchProfileSchema = z.object({
  name: z.string().min(1).optional(),
  province: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

// GET /api/profile
export async function GET(_req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      province: true,
      locality: true,
      platformRole: true,
      createdAt: true,
      memberships: {
        include: {
          club: {
            select: {
              id: true,
              name: true,
              sport: true,
              colorTheme: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!user) return err('Usuario no encontrado', 404)
  return ok(user)
}

// PATCH /api/profile
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  // Handle password change separately
  if (body.currentPassword !== undefined) {
    const parsed = ChangePasswordSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0].message)

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { password: true },
    })
    if (!user) return err('Usuario no encontrado', 404)
    if (!user.password) return err('No tienes contraseña configurada (cuenta OAuth)', 400)

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
    if (!valid) return err('Contraseña actual incorrecta', 401)

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12)
    await prisma.user.update({
      where: { id: auth.userId },
      data: { password: newHash },
    })
    return ok({ success: true, message: 'Contraseña actualizada' })
  }

  // Handle profile update
  const parsed = PatchProfileSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      province: true,
      locality: true,
    },
  })

  return ok(updated)
}
