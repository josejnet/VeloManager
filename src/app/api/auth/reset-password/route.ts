import { NextRequest } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/utils'

const Schema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(72),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const reset = await prisma.passwordReset.findUnique({
    where: { token: parsed.data.token },
  })

  if (!reset || reset.used || reset.expiresAt < new Date()) {
    return err('El enlace de recuperación es inválido o ha caducado', 400)
  }

  const hashed = await hash(parsed.data.password, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password: hashed } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
  ])

  return ok({ message: 'Contraseña actualizada correctamente' })
}
