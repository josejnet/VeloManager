import { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, passwordResetEmail } from '@/lib/email'
import { ok, err } from '@/lib/utils'

const Schema = z.object({ email: z.string().email().toLowerCase() })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err('Email inválido')

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

  // Always return OK to avoid email enumeration
  if (!user) return ok({ message: 'Si el email existe, recibirás un enlace.' })

  // Invalidate old tokens
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } })

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
  const { subject, html } = passwordResetEmail(user.name, resetUrl)

  await sendEmail({ to: user.email, subject, html })

  return ok({ message: 'Si el email existe, recibirás un enlace.' })
}
