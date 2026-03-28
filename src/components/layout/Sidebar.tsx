'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Wallet, ShoppingBag, Vote,
  Settings, ClipboardList, LogOut, Trophy, Globe,
  Calendar, Mail, Bell, BarChart2, AlertCircle, User,
  ShieldCheck, LifeBuoy, Ticket,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Socios', href: '/admin/members', icon: Users },
  { label: 'Directorio', href: '/admin/members/directory', icon: ClipboardList },
  { label: 'Deudas', href: '/admin/members/debt', icon: AlertCircle },
  { label: 'Contabilidad', href: '/admin/accounting', icon: Wallet },
  { label: 'Informes', href: '/admin/accounting/reports', icon: BarChart2 },
  { label: 'Compras conjuntas', href: '/admin/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/admin/votes', icon: Vote },
  { label: 'Eventos', href: '/admin/events', icon: Calendar },
  { label: 'Mensajería', href: '/admin/messages', icon: Globe },
  { label: 'Anuncios', href: '/admin/announcements', icon: Bell },
  { label: 'Auditoría', href: '/admin/audit', icon: ClipboardList },
  { label: 'Soporte', href: '/admin/support', icon: LifeBuoy },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
]

const socioNav: NavItem[] = [
  { label: 'Mi Club', href: '/socio', icon: LayoutDashboard },
  { label: 'Mis Pedidos', href: '/socio/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/socio/votes', icon: Vote },
  { label: 'Eventos', href: '/socio/events', icon: Calendar },
  { label: 'Mensajes', href: '/socio/inbox', icon: Mail },
  { label: 'Mi Perfil', href: '/socio/profile', icon: User },
  { label: 'Soporte', href: '/socio/support', icon: LifeBuoy },
]

const superAdminNav: NavItem[] = [
  { label: 'Plataforma', href: '/superadmin', icon: Globe },
  { label: 'Todos los clubs', href: '/superadmin/clubs', icon: Trophy },
  { label: 'Usuarios', href: '/superadmin/users', icon: Users },
  { label: 'Banners', href: '/superadmin/banners', icon: Bell },
  { label: 'Módulos', href: '/superadmin/modules', icon: ShieldCheck },
  { label: 'Tickets', href: '/superadmin/tickets', icon: Ticket },
]

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'
  clubName?: string
  clubLogo?: string | null
  colorTheme?: string
  isAdminViewingAsSocio?: boolean
  mode?: 'admin' | 'socio' | 'superadmin'
}

export function Sidebar({ role, clubName, clubLogo, colorTheme, isAdminViewingAsSocio, mode = 'socio' }: SidebarProps) {
  const pathname = usePathname()
  const nav = role === 'SUPER_ADMIN' ? superAdminNav : role === 'CLUB_ADMIN' ? adminNav : socioNav

  // If a CLUB_ADMIN is currently in the socio view, show socio nav + admin panel link
  const effectiveNav = isAdminViewingAsSocio ? socioNav : nav

  // Visual mode indicator: top border color signals admin vs socio context
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

      {/* Admin panel shortcut (shown when CLUB_ADMIN is in socio view) */}
      {isAdminViewingAsSocio && (
        <div className="mx-3 mt-3">
          <Link
            href="/admin"
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
          const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/socio' && pathname.startsWith(item.href))
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
