'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Wallet, ShoppingBag, Vote,
  Settings, ClipboardList, LogOut, Trophy, Globe,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Socios', href: '/admin/members', icon: Users },
  { label: 'Contabilidad', href: '/admin/accounting', icon: Wallet },
  { label: 'Compras conjuntas', href: '/admin/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/admin/votes', icon: Vote },
  { label: 'Mensajería', href: '/admin/messages', icon: Globe },
  { label: 'Anuncios', href: '/admin/announcements', icon: Trophy },
  { label: 'Auditoría', href: '/admin/audit', icon: ClipboardList },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
]

const socioNav: NavItem[] = [
  { label: 'Mi Club', href: '/socio', icon: LayoutDashboard },
  { label: 'Mis Pedidos', href: '/socio/purchases', icon: ShoppingBag },
  { label: 'Votaciones', href: '/socio/votes', icon: Vote },
]

const superAdminNav: NavItem[] = [
  { label: 'Plataforma', href: '/superadmin', icon: Globe },
  { label: 'Todos los clubs', href: '/superadmin/clubs', icon: Trophy },
  { label: 'Usuarios', href: '/superadmin/users', icon: Users },
  { label: 'Banners', href: '/superadmin/banners', icon: Vote },
]

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO'
  clubName?: string
  clubLogo?: string | null
  colorTheme?: string
}

export function Sidebar({ role, clubName, clubLogo, colorTheme }: SidebarProps) {
  const pathname = usePathname()
  const nav = role === 'SUPER_ADMIN' ? superAdminNav : role === 'CLUB_ADMIN' ? adminNav : socioNav

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
              {clubName ?? 'Club Nexus'}
            </p>
            <p className="text-xs text-gray-400">
              {role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'CLUB_ADMIN' ? 'Administrador' : 'Socio'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item) => {
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
