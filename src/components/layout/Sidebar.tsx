'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Wallet, ShoppingBag, Vote,
  Settings, ClipboardList, LogOut, Trophy, Globe,
  Calendar, Mail, Bell, BarChart2, AlertCircle, User,
  ShieldCheck, LifeBuoy, Ticket, BellRing, Megaphone,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

// Build nav arrays dynamically based on base path (empty string = old /admin|/socio structure)
function makeAdminNav(base: string): NavItem[] {
  return [
    { label: 'Dashboard', href: `${base}/admin`, icon: LayoutDashboard },
    { label: 'Socios', href: `${base}/admin/members`, icon: Users },
    { label: 'Directorio', href: `${base}/admin/members/directory`, icon: ClipboardList },
    { label: 'Deudas', href: `${base}/admin/members/debt`, icon: AlertCircle },
    { label: 'Contabilidad', href: `${base}/admin/accounting`, icon: Wallet },
    { label: 'Informes', href: `${base}/admin/accounting/reports`, icon: BarChart2 },
    { label: 'Compras conjuntas', href: `${base}/admin/purchases`, icon: ShoppingBag },
    { label: 'Votaciones', href: `${base}/admin/votes`, icon: Vote },
    { label: 'Eventos', href: `${base}/admin/events`, icon: Calendar },
    { label: 'Mensajería', href: `${base}/admin/messages`, icon: Globe },
    { label: 'Anuncios', href: `${base}/admin/announcements`, icon: Bell },
    { label: 'Auditoría', href: `${base}/admin/audit`, icon: ClipboardList },
    { label: 'Notificaciones', href: `${base}/notifications`, icon: BellRing },
    { label: 'Soporte', href: `${base}/admin/support`, icon: LifeBuoy },
    { label: 'Configuración', href: `${base}/admin/settings`, icon: Settings },
  ]
}

function makeSocioNav(base: string): NavItem[] {
  return [
    { label: 'Mi Club', href: `${base}/socio`, icon: LayoutDashboard },
    { label: 'Mis Pedidos', href: `${base}/socio/purchases`, icon: ShoppingBag },
    { label: 'Votaciones', href: `${base}/socio/votes`, icon: Vote },
    { label: 'Eventos', href: `${base}/socio/events`, icon: Calendar },
    { label: 'Mensajes', href: `${base}/socio/inbox`, icon: Mail },
    { label: 'Mi Perfil', href: `${base}/socio/profile`, icon: User },
    { label: 'Notificaciones', href: `${base}/notifications`, icon: BellRing },
    { label: 'Soporte', href: `${base}/socio/support`, icon: LifeBuoy },
  ]
}

// Superadmin nav never changes (no club context)
const superAdminNav: NavItem[] = [
  { label: 'Plataforma', href: '/superadmin', icon: Globe },
  { label: 'Todos los clubs', href: '/superadmin/clubs', icon: Trophy },
  { label: 'Usuarios', href: '/superadmin/users', icon: Users },
  { label: 'Banners', href: '/superadmin/banners', icon: Bell },
  { label: 'Publicidad', href: '/superadmin/ads', icon: Megaphone },
  { label: 'Módulos', href: '/superadmin/modules', icon: ShieldCheck },
  { label: 'Tickets', href: '/superadmin/tickets', icon: Ticket },
  { label: 'Configuración', href: '/superadmin/settings', icon: Settings },
]

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'
  clubName?: string
  clubLogo?: string | null
  colorTheme?: string
  isAdminViewingAsSocio?: boolean
  mode?: 'admin' | 'socio' | 'superadmin'
  /**
   * Base path prefix for all nav hrefs.
   * Use "/clubs/[clubId]" in the new route structure, "" in the legacy structure.
   */
  baseHref?: string
}

export function Sidebar({
  role,
  clubName,
  clubLogo,
  colorTheme: _colorTheme,
  isAdminViewingAsSocio,
  mode = 'socio',
  baseHref = '',
}: SidebarProps) {
  const pathname = usePathname()

  // Build nav for current context
  const adminNav = makeAdminNav(baseHref)
  const socioNav = makeSocioNav(baseHref)

  const nav = role === 'SUPER_ADMIN' ? superAdminNav : role === 'ADMIN' ? adminNav : socioNav
  const effectiveNav = isAdminViewingAsSocio ? socioNav : nav

  // Root paths that should match exactly (not as prefix)
  const exactRoots = [
    `${baseHref}/admin`,
    `${baseHref}/socio`,
    '/superadmin',
  ]

  // Visual mode indicator
  const modeBorderClass = mode === 'admin'
    ? 'border-t-4 border-t-orange-400'
    : mode === 'socio'
      ? 'border-t-4 border-t-blue-400'
      : 'border-t-4 border-t-red-400'

  const modeLabel = mode === 'admin' ? 'GESTIÓN' : mode === 'socio' ? 'SOCIO' : 'SUPER ADMIN'
  const modeLabelClass = mode === 'admin'
    ? 'text-orange-600 bg-orange-50'
    : mode === 'socio'
      ? 'text-blue-600 bg-blue-50'
      : 'text-red-600 bg-red-50'

  return (
    <aside className={cn('w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col', modeBorderClass)}>
      {/* Club brand */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            {clubLogo ? (
              <img src={clubLogo} alt="logo" className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <Trophy className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {clubName ?? 'Clube'}
            </p>
            <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 tracking-wide', modeLabelClass)}>
              {modeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Admin panel shortcut (shown when ADMIN is in socio view) */}
      {isAdminViewingAsSocio && (
        <div className="mx-3 mt-3">
          <Link
            href={`${baseHref}/admin`}
            className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            Panel de gestión
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {effectiveNav.map((item) => {
          const active = pathname === item.href || (!exactRoots.includes(item.href) && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('sidebar-item', active && 'active')}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="sidebar-item w-full text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
