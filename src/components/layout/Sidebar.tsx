'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { ClubRole } from '@/lib/permissions'
import {
  LayoutDashboard, Users, Wallet, ShoppingBag, Vote,
  Settings, ClipboardList, LogOut, Trophy,
  Calendar, Mail, Bell, BarChart2, AlertCircle, User,
  ShieldCheck, LifeBuoy, Ticket, BellRing, Megaphone,
  Globe, ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  role: 'SUPER_ADMIN' | ClubRole
  clubName?: string
  clubLogo?: string | null
  colorTheme?: string
  baseHref?: string
  mode?: 'admin' | 'socio' | 'superadmin'
  /** @deprecated no tiene efecto — el sidebar es ahora único y dinámico */
  isAdminViewingAsSocio?: boolean
}

const superAdminNav = [
  { label: 'Plataforma',      href: '/superadmin',          icon: Globe },
  { label: 'Todos los clubs', href: '/superadmin/clubs',    icon: Trophy },
  { label: 'Usuarios',        href: '/superadmin/users',    icon: Users },
  { label: 'Banners',         href: '/superadmin/banners',  icon: Bell },
  { label: 'Publicidad',      href: '/superadmin/ads',      icon: Megaphone },
  { label: 'Módulos',         href: '/superadmin/modules',  icon: ShieldCheck },
  { label: 'Tickets',         href: '/superadmin/tickets',  icon: Ticket },
  { label: 'Configuración',   href: '/superadmin/settings', icon: Settings },
]

export function Sidebar({ role, clubName, clubLogo, baseHref = '', mode = 'socio' }: SidebarProps) {
  const pathname = usePathname()
  const [gestionOpen, setGestionOpen] = useState(true)
  const [socioOpen, setSocioOpen] = useState(true)

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  const socioNav = [
    { label: 'Mi Club',        href: `${baseHref}/socio`,           icon: LayoutDashboard },
    { label: 'Eventos',        href: `${baseHref}/socio/events`,    icon: Calendar },
    { label: 'Mis Pedidos',    href: `${baseHref}/socio/purchases`, icon: ShoppingBag },
    { label: 'Votaciones',     href: `${baseHref}/socio/votes`,     icon: Vote },
    { label: 'Mensajes',       href: `${baseHref}/socio/inbox`,     icon: Mail },
    { label: 'Mi Perfil',      href: `${baseHref}/socio/profile`,   icon: User },
    { label: 'Notificaciones', href: `${baseHref}/notifications`,   icon: BellRing },
    { label: 'Soporte',        href: `${baseHref}/socio/support`,   icon: LifeBuoy },
  ]

  const gestionNav = [
    { label: 'Dashboard',         href: `${baseHref}/admin`,                   icon: LayoutDashboard, action: null },
    { label: 'Socios',            href: `${baseHref}/admin/members`,           icon: Users,           action: 'members:manage' },
    { label: 'Deudas',            href: `${baseHref}/admin/members/debt`,      icon: AlertCircle,     action: 'members:view_debt' },
    { label: 'Contabilidad',      href: `${baseHref}/admin/accounting`,        icon: Wallet,          action: 'accounting:read' },
    { label: 'Informes',          href: `${baseHref}/admin/accounting/reports`,icon: BarChart2,       action: 'accounting:read' },
    { label: 'Compras conjuntas', href: `${baseHref}/admin/purchases`,         icon: ShoppingBag,     action: 'purchases:manage' },
    { label: 'Votaciones',        href: `${baseHref}/admin/votes`,             icon: Vote,            action: 'votes:create' },
    { label: 'Eventos',           href: `${baseHref}/admin/events`,            icon: Calendar,        action: 'events:create' },
    { label: 'Mensajería',        href: `${baseHref}/admin/messages`,          icon: Globe,           action: 'messages:broadcast' },
    { label: 'Anuncios',          href: `${baseHref}/admin/announcements`,     icon: Bell,            action: 'announcements:create' },
    { label: 'Soporte',           href: `${baseHref}/admin/support`,           icon: LifeBuoy,        action: 'members:manage' },
    { label: 'Configuración',     href: `${baseHref}/admin/settings`,          icon: Settings,        action: 'settings:write' },
  ] as const

  const visibleGestion = role === 'SUPER_ADMIN'
    ? gestionNav
    : gestionNav.filter(item => item.action === null || can(role as ClubRole, item.action))

  const modeBorderClass =
    mode === 'superadmin' ? 'border-t-4 border-t-red-400' :
    isAdmin               ? 'border-t-4 border-t-orange-400' :
                            'border-t-4 border-t-blue-400'

  function isActive(href: string): boolean {
    const exactRoots = [`${baseHref}/admin`, `${baseHref}/socio`, '/superadmin']
    if (exactRoots.includes(href)) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  if (role === 'SUPER_ADMIN') {
    return (
      <aside className={cn('w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col', modeBorderClass)}>
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-500 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Super Admin</p>
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 tracking-wide text-red-600 bg-red-50">
                PLATAFORMA
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {superAdminNav.map(item => (
            <Link key={item.href} href={item.href}
              className={cn('sidebar-item', isActive(item.href) && 'active')}>
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <UserFooter isAdmin={false} isSuperAdmin={true} />
      </aside>
    )
  }

  return (
    <aside className={cn('w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col', modeBorderClass)}>
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            {clubLogo
              ? <img src={clubLogo} alt="logo" className="h-9 w-9 rounded-xl object-cover" />
              : <Trophy className="h-5 w-5 text-white" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{clubName ?? 'Club'}</p>
            <span className={cn(
              'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 tracking-wide',
              isAdmin ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'
            )}>
              {isAdmin ? 'GESTOR' : 'SOCIO'}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Sección socio — colapsable solo para ADMIN */}
        <div>
          {isAdmin && (
            <button
              onClick={() => setSocioOpen(o => !o)}
              className="flex items-center justify-between w-full px-2 py-1.5 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <span>Mi club</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !socioOpen && '-rotate-90')} />
            </button>
          )}
          {(!isAdmin || socioOpen) && (
            <div className="space-y-0.5">
              {socioNav.map(item => (
                <Link key={item.href} href={item.href}
                  className={cn('sidebar-item', isActive(item.href) && 'active')}>
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sección gestión — solo si tiene permisos */}
        {isAdmin && (
          <div className="mt-4">
            <button
              onClick={() => setGestionOpen(o => !o)}
              className="flex items-center justify-between w-full px-2 py-1.5 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <span>Gestión</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !gestionOpen && '-rotate-90')} />
            </button>
            {gestionOpen && (
              <div className="space-y-0.5">
                {visibleGestion.map(item => (
                  <Link key={item.href} href={item.href}
                    className={cn('sidebar-item', isActive(item.href) && 'active')}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <UserFooter isAdmin={isAdmin} isSuperAdmin={false} />
    </aside>
  )
}

function UserFooter({ isAdmin, isSuperAdmin }: { isAdmin: boolean; isSuperAdmin: boolean }) {
  const { data: session } = useSession()
  const sessionUser = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined
  const displayName = sessionUser?.name?.trim() || sessionUser?.email?.split('@')[0] || 'Usuario'
  const initials = (() => {
    const src = sessionUser?.name?.trim() || sessionUser?.email?.split('@')[0] || '?'
    const parts = src.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return src.slice(0, 2).toUpperCase()
  })()
  const avatarImage = sessionUser?.image ?? null

  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Gestor' : 'Socio'
  const roleCls = isSuperAdmin
    ? 'text-red-600 bg-red-50'
    : isAdmin
      ? 'text-orange-600 bg-orange-50'
      : 'text-blue-600 bg-blue-50'

  return (
    <div className="border-t border-gray-100 px-3 pt-3 pb-4 space-y-2">
      {/* Identity card */}
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-gray-50">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarImage
            ? <img src={avatarImage} alt={displayName} className="h-full w-full object-cover" />
            : <span className="text-[11px] font-bold text-primary leading-none">{initials}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{displayName}</p>
          <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 tracking-wide', roleCls)}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="sidebar-item w-full text-red-500 hover:text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </button>
    </div>
  )
}
