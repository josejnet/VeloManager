/**
 * Admin route guard — server component layout.
 *
 * Protege TODAS las rutas bajo /clubs/[clubId]/admin/*.
 * Si el usuario no es ADMIN del club (ni SUPER_ADMIN), redirige
 * a su vista de socio en el mismo club en vez de mostrar un 403.
 *
 * PERFORMANCE: Usa getCachedSession / getCachedUserRole / getCachedMembership
 * para que estas queries no se ejecuten de nuevo si ClubLayout ya las realizó
 * en el mismo render pass (React cache() deduplication).
 */
import { redirect } from 'next/navigation'
import { getCachedSession, getCachedUserRole, getCachedMembership } from '@/lib/session'

interface AdminGuardProps {
  children: React.ReactNode
  params: Promise<{ clubId: string }>
}

export default async function AdminGuard({ children, params }: AdminGuardProps) {
  const { clubId } = await params

  // getCachedSession: zero cost if ClubLayout already called it this request
  const session = await getCachedSession()
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  // getCachedUserRole: zero cost if ClubLayout already called it this request
  const dbUser = await getCachedUserRole(userId)

  // SUPER_ADMIN tiene acceso total — sin más queries
  if (dbUser?.platformRole === 'SUPER_ADMIN') return <>{children}</>

  // getCachedMembership: zero cost — ClubLayout already fetched this
  const membership = await getCachedMembership(userId, clubId)

  if (!membership || membership.clubRole !== 'ADMIN') {
    // No es admin — redirige a la vista de socio (no muestra 403)
    redirect(`/clubs/${clubId}/socio`)
  }

  return <>{children}</>
}
