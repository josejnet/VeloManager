'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Wallet, ShoppingBag, Vote,
  Settings, ClipboardList, LogOut, Trophy, Globe,
  Calendar, Mail, Bell, BarChart2, AlertCircle, User,
  ShieldCheck, Megaphone,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Socios', href: '/admin/members', icon: Users },
  { label: 'Deudas', href: '/admin/members/debt', icon: AlertCircle },
  { label: 'Contabilidad', href: '/admin/accounting', icon: Wallet },
  { label: 'Informes', href: '/admin/accounting/reports', icon: BarChart2 },
  { label: 'Compras conjuntas', href: '/admin/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/admin/votes', icon: Vote },
  { label: 'Eventos', href: '/admin/events', icon: Calendar },
  { label: 'Mensajería', href: '/admin/messages', icon: Globe },
  { label: 'Anuncios', href: '/admin/announcements', icon: Bell },
  { label: 'Auditoría', href: '/admin/audit', icon: ClipboardList },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
]

const socioNav: NavItem[] = [
  { label: 'Mi Club', href: '/socio', icon: LayoutDashboard },
  { label: 'Mis Pedidos', href: '/socio/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/socio/votes', icon: Vote },
  { label: 'Eventos', href: '/socio/events', icon: Calendar },
  { label: 'Mensajes', href: '/socio/inbox', icon: Mail },
  { label: 'Mi Perfil', href: '/socio/profile', icon: User },
]

const superAdminNav: NavItem[] = [
  { label: 'Plataforma', href: '/superadmin', icon: Globe },
  { label: 'Todos los clubs', href: '/superadmin/clubs', icon: Trophy },
  { label: 'Usuarios', href: '/superadmin/users', icon: Users },
  { label: 'Banners', href: '/superadmin/banners', icon: Bell },
  { label: 'Publicidad', href: '/superadmin/ads', icon: Megaphone },
  { label: 'Módulos', href: '/superadmin/modules', icon: ShieldCheck },
]

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'
  clubName?: string
  clubLogo?: string | null
  colorTheme?: string
}

export function Sidebar({ role, clubName, clubLogo }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Computed client-side from the live pathname — never stale, no server re-render needed
  const isAdminViewingAsSocio = role === 'CLUB_ADMIN' && pathname.startsWith('/socio')

  const baseNav = role === 'SUPER_ADMIN' ? superAdminNav : role === 'CLUB_ADMIN' ? adminNav : socioNav
  const effectiveNav = isAdminViewingAsSocio ? socioNav : baseNav

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
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
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {clubName ?? 'Club'}
            </p>
            <p className="text-xs text-gray-400">
              {role === 'SUPER_ADMIN' ? 'Super Admin' : isAdminViewingAsSocio ? 'Socio' : role === 'CLUB_ADMIN' ? 'Administrador' : 'Socio'}
            </p>
          </div>
        </div>
      </div>

      {/* Mode toggle — only visible to CLUB_ADMIN */}
      {role === 'CLUB_ADMIN' && (
        <div className="mx-3 mt-3">
          <button
            onClick={() => router.push(isAdminViewingAsSocio ? '/admin' : '/socio')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
              isAdminViewingAsSocio
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {isAdminViewingAsSocio
              ? <><ShieldCheck className="h-4 w-4 flex-shrink-0" /> Panel de administración</>
              : <><User className="h-4 w-4 flex-shrink-0" /> Vista de socio</>}
          </button>
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
              prefetch={true}
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


interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Socios', href: '/admin/members', icon: Users },
  { label: 'Deudas', href: '/admin/members/debt', icon: AlertCircle },
  { label: 'Contabilidad', href: '/admin/accounting', icon: Wallet },
  { label: 'Informes', href: '/admin/accounting/reports', icon: BarChart2 },
  { label: 'Compras conjuntas', href: '/admin/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/admin/votes', icon: Vote },
  { label: 'Eventos', href: '/admin/events', icon: Calendar },
  { label: 'Mensajería', href: '/admin/messages', icon: Globe },
  { label: 'Anuncios', href: '/admin/announcements', icon: Bell },
  { label: 'Auditoría', href: '/admin/audit', icon: ClipboardList },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
]

const socioNav: NavItem[] = [
  { label: 'Mi Club', href: '/socio', icon: LayoutDashboard },
  { label: 'Mis Pedidos', href: '/socio/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/socio/votes', icon: Vote },
  { label: 'Eventos', href: '/socio/events', icon: Calendar },
  { label: 'Mensajes', href: '/socio/inbox', icon: Mail },
  { label: 'Mi Perfil', href: '/socio/profile', icon: User },
]

const superAdminNav: NavItem[] = [
  { label: 'Plataforma', href: '/superadmin', icon: Globe },
  { label: 'Todos los clubs', href: '/superadmin/clubs', icon: Trophy },
  { label: 'Usuarios', href: '/superadmin/users', icon: Users },
  { label: 'Banners', href: '/superadmin/banners', icon: Bell },
  { label: 'Publicidad', href: '/superadmin/ads', icon: Megaphone },
  { label: 'Módulos', href: '/superadmin/modules', icon: ShieldCheck },
]

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'
  clubName?: string
  clubLogo?: string | null
  colorTheme?: string
  /** If true, we're showing the SOCIO view but user is actually a CLUB_ADMIN */
  isAdminViewingAsSocio?: boolean
}

export function Sidebar({ role, clubName, clubLogo, colorTheme, isAdminViewingAsSocio }: SidebarProps) {
  const pathname = usePathname()
  const nav = role === 'SUPER_ADMIN' ? superAdminNav : role === 'CLUB_ADMIN' ? adminNav : socioNav

  // If a CLUB_ADMIN is currently in the socio view, show socio nav + admin panel link
  const effectiveNav = isAdminViewingAsSocio ? socioNav : nav

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
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
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {clubName ?? 'Clube'}
            </p>
            <p className="text-xs text-gray-400">
              {role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'CLUB_ADMIN' && !isAdminViewingAsSocio ? 'Administrador' : 'Socio'}
            </p>
          </div>
        </div>
      </div>

      {/* Admin panel banner (shown when CLUB_ADMIN is in socio view) */}
      {isAdminViewingAsSocio && (
        <div className="mx-3 mt-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            Panel de administración
          </Link>
        </div>
      )}

      {/* Socio view link (shown when CLUB_ADMIN is in admin view) */}
      {!isAdminViewingAsSocio && role === 'CLUB_ADMIN' && (
        <div className="mx-3 mt-3">
          <Link
            href="/socio"
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
          >
            <User className="h-4 w-4 flex-shrink-0" />
            Vista de socio
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
              prefetch={true}
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
