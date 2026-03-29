/**
 * Admin route guard — server component layout.
 *
 * Protege TODAS las rutas bajo /clubs/[clubId]/admin/*.
 * Si el usuario no es ADMIN del club (ni SUPER_ADMIN), redirige
 * a su vista de socio en el mismo club en vez de mostrar un 403.
 *
 * Esto asegura que ocultar el link en el sidebar NO es suficiente
 * para proteger la ruta — el servidor siempre verifica.
 */
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AdminGuardProps {
  children: React.ReactNode
  params: Promise<{ clubId: string }>
}

export default async function AdminGuard({ children, params }: AdminGuardProps) {
  const { clubId } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  })

  // SUPER_ADMIN tiene acceso total
  if (dbUser?.platformRole === 'SUPER_ADMIN') return <>{children}</>

  // Verifica membresía ADMIN en este club específico
  const membership = await prisma.clubMembership.findFirst({
    where: { userId, clubId, status: 'APPROVED', clubRole: 'ADMIN' },
    select: { id: true },
  })

  if (!membership) {
    // No es admin — redirige a la vista de socio (no muestra 403)
    redirect(`/clubs/${clubId}/socio`)
  }

  return <>{children}</>
}
