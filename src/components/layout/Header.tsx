'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ShieldCheck, User, ArrowLeftRight } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ClubSwitcher } from '@/components/layout/ClubSwitcher'
import { useDashboard } from '@/providers/DashboardProvider'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  /** Kept for backward compat — clubId now comes from DashboardProvider */
  clubId?: string
}

const MODE_CONFIG = {
  admin: {
    label: 'Gestor',
    icon: ShieldCheck,
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  socio: {
    label: 'Socio',
    icon: User,
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  superadmin: {
    label: 'Super Admin',
    icon: ShieldCheck,
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { clubId, mode, role, isAdminViewingAsSocio } = useDashboard()

  const user = session?.user as { name?: string | null } | undefined
  const cfg = MODE_CONFIG[mode]
  const ModeIcon = cfg.icon
  const canToggle = role === 'CLUB_ADMIN'

  // Detect new URL structure: /clubs/[clubId]/...
  const isNewStructure = pathname.startsWith('/clubs/')
  const baseHref = isNewStructure ? `/clubs/${clubId}` : ''

  const handleToggle = () => {
    if (isNewStructure) {
      // URL-based navigation — no cookie needed
      if (mode === 'admin' || isAdminViewingAsSocio) {
        router.push(`${baseHref}/socio`)
      } else {
        router.push(`${baseHref}/admin`)
      }
    } else {
      // Legacy cookie-based navigation
      if (mode === 'admin' || isAdminViewingAsSocio) {
        router.push('/socio')
      } else {
        router.push('/admin')
      }
    }
  }

  const handleClubSwitch = (newClubId: string) => {
    if (isNewStructure) {
      // URL-based switch: keep section (admin/socio) from current path
      const parts = pathname.split('/')
      // /clubs/[clubId]/admin/... → parts[3] = 'admin' or 'socio'
      const section = parts[3] === 'socio' ? 'socio' : 'admin'
      router.push(`/clubs/${newClubId}/${section}`)
    } else {
      // Legacy: set cookie + navigate
      document.cookie = `activeClubId=${newClubId}; path=/; max-age=31536000; SameSite=Lax`
      const dest = mode === 'admin' ? '/admin' : '/socio'
      router.push(dest)
      router.refresh()
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 gap-4">
      <h1 className="text-lg font-semibold text-gray-900 truncate flex-1">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Current mode badge */}
        <span className={cn('hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', cfg.className)}>
          <ModeIcon className="h-3.5 w-3.5" />
          {cfg.label}
        </span>

        {/* Mode toggle — CLUB_ADMIN only */}
        {canToggle && (
          <button
            onClick={handleToggle}
            title={mode === 'admin' ? 'Cambiar a vista de socio' : 'Cambiar a panel de gestión'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {mode === 'admin' ? 'Vista socio' : 'Panel gestor'}
            </span>
          </button>
        )}

        {/* Club switcher */}
        {clubId && mode !== 'superadmin' && (
          <ClubSwitcher
            userId=""
            currentClubId={clubId}
            onSwitch={handleClubSwitch}
          />
        )}

        <NotificationBell clubId={clubId} />

        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      </div>
    </header>
  )
}
