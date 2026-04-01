'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useRef, useState, useEffect } from 'react'
import { ShieldCheck, User, LogOut, UserCircle, Settings } from 'lucide-react'
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

/** Derive up-to-2-char initials from a display name or email. */
function getInitials(name?: string | null, email?: string | null): string {
  const src = name?.trim() || email?.split('@')[0] || '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { clubId, mode, role, isAdminViewingAsSocio } = useDashboard()

  const sessionUser = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined
  const displayName = sessionUser?.name?.trim() || sessionUser?.email?.split('@')[0] || 'Usuario'
  const initials = getInitials(sessionUser?.name, sessionUser?.email)
  const avatarImage = sessionUser?.image ?? null

  const cfg = MODE_CONFIG[mode]
  const ModeIcon = cfg.icon
  const canToggle = role === 'ADMIN'

  const isNewStructure = pathname.startsWith('/clubs/')
  const baseHref = isNewStructure ? `/clubs/${clubId}` : ''

  // User dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleToggle = () => {
    if (isNewStructure) {
      if (mode === 'admin' || isAdminViewingAsSocio) {
        router.push(`${baseHref}/socio`)
      } else {
        router.push(`${baseHref}/admin`)
      }
    } else {
      if (mode === 'admin' || isAdminViewingAsSocio) {
        router.push('/socio')
      } else {
        router.push('/admin')
      }
    }
  }

  const handleClubSwitch = (newClubId: string) => {
    if (isNewStructure) {
      const parts = pathname.split('/')
      const section = parts[3] === 'socio' ? 'socio' : 'admin'
      router.push(`/clubs/${newClubId}/${section}`)
    } else {
      document.cookie = `activeClubId=${newClubId}; path=/; max-age=31536000; SameSite=Lax`
      const dest = mode === 'admin' ? '/admin' : '/socio'
      router.push(dest)
      router.refresh()
    }
  }

  const profileHref = isNewStructure ? `${baseHref}/socio/profile` : '/socio/profile'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 gap-4">
      <h1 className="text-lg font-semibold text-gray-900 truncate flex-1">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Current mode badge */}
        {canToggle ? (
          <button
            onClick={handleToggle}
            title={mode === 'admin' ? 'Cambiar a vista Socio' : 'Cambiar a vista Gestor'}
            className={cn(
              'hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-75',
              cfg.className,
            )}
          >
            <ModeIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </button>
        ) : (
          <span className={cn('hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', cfg.className)}>
            <ModeIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </span>
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

        {/* ── User identity chip + dropdown ─────────────────────────────── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full hover:bg-gray-100 transition-colors group"
            aria-label="Menú de usuario"
          >
            {/* Avatar */}
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {avatarImage
                ? <img src={avatarImage} alt={displayName} className="h-full w-full object-cover" />
                : <span className="text-[11px] font-bold text-primary leading-none">{initials}</span>
              }
            </div>
            {/* Name — hidden on very small screens */}
            <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
              {displayName}
            </span>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              {/* Identity header */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                {sessionUser?.email && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{sessionUser.email}</p>
                )}
              </div>

              <button
                onClick={() => { setDropdownOpen(false); router.push(profileHref) }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <UserCircle className="h-4 w-4 text-gray-400" />
                Mi perfil
              </button>

              {mode !== 'superadmin' && (
                <button
                  onClick={() => { setDropdownOpen(false); router.push(isNewStructure ? `${baseHref}/admin/settings` : '/admin/settings') }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  Configuración del club
                </button>
              )}

              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
