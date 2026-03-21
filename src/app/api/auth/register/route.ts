import { NextRequest } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { ok, err } from '@/lib/utils'

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return err('Email ya registrado', 409)

  const hashed = await hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
    select: { id: true, email: true, name: true, role: true },
  })

  return ok(user, 201)
}
