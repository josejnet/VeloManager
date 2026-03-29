'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useDashboard } from '@/providers/DashboardProvider'
import {
  Calendar,
  MapPin,
  Wallet,
  ShoppingBag,
  CheckSquare,
  Megaphone,
  Trophy,
  Bell,
  ShoppingCart,
  LifeBuoy,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pin,
  Zap,
} from 'lucide-react'

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface ClubInfo {
  id: string
  name: string
  slogan: string | null
  sport: string
  logoUrl: string | null
  colorTheme: string | null
}

interface MembershipInfo {
  id: string
  role: string
  joinedAt: string | null
}

interface PendingQuota {
  id: string
  year: number
  amount: number
  status: string
  dueDate: string | null
}

interface UnpaidOrder {
  id: string
  windowName: string
  totalAmount: number
  createdAt: string
}

interface UnpaidEventPayment {
  id: string
  eventId: string
  eventTitle: string
  eventDate: string
  amount: number
}

interface Priorities {
  pendingQuotas: PendingQuota[]
  unpaidOrders: UnpaidOrder[]
  unpaidEventPayments: UnpaidEventPayment[]
}

interface UpcomingEvent {
  id: string
  title: string
  startAt: string
  location: string | null
  type: string
  price: number | null
  myAttendanceStatus: string | null
}

interface RecentOrder {
  id: string
  windowName: string
  totalAmount: number
  status: string
  itemCount: number
  createdAt: string
}

interface Quota {
  id: string
  year: number
  amount: number
  status: string
  dueDate: string | null
}

interface VoteOptionResult {
  id: string
  text: string
  count: number
}

interface ActiveVote {
  id: string
  title: string
  status: 'scheduled' | 'active' | 'closed'
  closedAt: string | null
  endsAt: string | null
  totalResponses: number
  hasVoted: boolean
  myOptionId: string | null
  options: VoteOptionResult[]
}

interface Announcement {
  id: string
  title: string
  body: string
  createdAt: string
  pinned: boolean
}

interface Stats {
  unreadNotifications: number
  openPurchaseWindows: number
  totalPendingAmount: number
}

interface DashboardData {
  club: ClubInfo
  membership: MembershipInfo
  priorities: Priorities
  upcomingEvents: UpcomingEvent[]
  recentOrders: RecentOrder[]
  quotas: Quota[]
  activeVotes: ActiveVote[]
  announcements: Announcement[]
  stats: Stats
}

// ─── Formatting Helpers ────────────────────────────────────────────────────────

function fmtDate(d: string | null | Date) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
}

function fmtDay(d: string) {
  return new Date(d).getDate()
}

// ─── Event Type Config ─────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  TRAINING: { label: 'Entrenamiento', color: 'text-blue-700', bg: 'bg-blue-50' },
  RACE:     { label: 'Carrera',       color: 'text-red-700',  bg: 'bg-red-50'  },
  SOCIAL:   { label: 'Social',        color: 'text-green-700',bg: 'bg-green-50'},
  MEETING:  { label: 'Reunión',       color: 'text-purple-700',bg:'bg-purple-50'},
  TRIP:     { label: 'Salida',        color: 'text-orange-700',bg:'bg-orange-50'},
  OTHER:    { label: 'Otro',          color: 'text-gray-700', bg: 'bg-gray-50' },
}

function getEventTypeConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.OTHER
}

// ─── Quota Status Helpers ──────────────────────────────────────────────────────

function QuotaStatusBadge({ status }: { status: string }) {
  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Pagada
      </span>
    )
  }
  if (status === 'OVERDUE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle className="h-3 w-3" /> Vencida
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  if (['PAID', 'CONFIRMED', 'DELIVERED'].includes(status)) {
    const label = status === 'DELIVERED' ? 'Entregado' : 'Confirmado'
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      Pendiente
    </span>
  )
}

// ─── Skeleton Loader ───────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="flex-1 p-6 space-y-6 animate-pulse">
      {/* Hero */}
      <div className="bg-gray-100 rounded-2xl h-36" />
      {/* Priorities */}
      <div className="bg-gray-100 rounded-2xl h-20" />
      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-100 rounded-2xl h-64" />
          <div className="bg-gray-100 rounded-2xl h-48" />
          <div className="bg-gray-100 rounded-2xl h-40" />
        </div>
        {/* Right col */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-100 rounded-2xl h-56" />
          <div className="bg-gray-100 rounded-2xl h-40" />
          <div className="bg-gray-100 rounded-2xl h-44" />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SocioDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const { clubId } = useDashboard()
  const baseHref = pathname.startsWith('/clubs/') ? `/clubs/${clubId}` : ''

  useEffect(() => {
    fetch('/api/dashboard/user')
      .then(async (r) => {
        if (!r.ok) return null
        return r.json() as Promise<DashboardData>
      })
      .then((json) => setData(json))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-400">No se pudo cargar el dashboard.</p>
      </div>
    )
  }

  const { club, membership, priorities, upcomingEvents, recentOrders, quotas, activeVotes, announcements, stats } = data
  const colorTheme = club.colorTheme || '#1e40af'

  const hasPendingItems =
    priorities.pendingQuotas.length > 0 ||
    priorities.unpaidOrders.length > 0 ||
    priorities.unpaidEventPayments.length > 0

  return (
    <div className="flex-1 p-6 space-y-6">

      {/* ── HERO CARD ─────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${colorTheme}, ${colorTheme}dd)` }}
      >
        <div className="flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {club.logoUrl ? (
                <img src={club.logoUrl} alt={club.name} className="h-10 w-10 object-contain rounded-xl" />
              ) : (
                <Trophy className="h-7 w-7 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{club.name}</h2>
              {club.slogan && <p className="text-white/70 text-sm mt-0.5">{club.slogan}</p>}
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-xs">
                {club.sport}
              </span>
            </div>
          </div>

          {/* Right – quick stats (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center min-w-[80px]">
              <Bell className="h-4 w-4 text-white/70 mx-auto mb-0.5" />
              <p className="text-white font-semibold text-sm">{stats.unreadNotifications}</p>
              <p className="text-white/60 text-xs">sin leer</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center min-w-[80px]">
              <ShoppingCart className="h-4 w-4 text-white/70 mx-auto mb-0.5" />
              <p className="text-white font-semibold text-sm">{stats.openPurchaseWindows}</p>
              <p className="text-white/60 text-xs">campaña(s)</p>
            </div>
            {stats.totalPendingAmount > 0 && (
              <div className="bg-orange-400/30 rounded-xl px-3 py-2 text-center min-w-[80px]">
                <Clock className="h-4 w-4 text-orange-200 mx-auto mb-0.5" />
                <p className="text-orange-100 font-semibold text-sm">{fmtCurrency(stats.totalPendingAmount)}</p>
                <p className="text-orange-200/70 text-xs">pendiente</p>
              </div>
            )}
          </div>
        </div>

        {/* Member since */}
        <p className="mt-4 text-white/50 text-xs">
          Socio desde {fmtDate(membership.joinedAt)}
        </p>
      </div>

      {/* ── PRIORITIES BANNER ─────────────────────────────────────────────────── */}
      {hasPendingItems && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-3">
            <AlertTriangle className="h-4 w-4" />
            Tienes acciones pendientes
          </p>
          <div className="flex flex-wrap gap-2">
            {priorities.pendingQuotas.map((q) => (
              <Link
                key={q.id}
                href={`${baseHref}/socio/quotas`}
                className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full hover:bg-amber-200 transition-colors"
              >
                Cuota {q.year} — {fmtCurrency(q.amount)}
              </Link>
            ))}
            {priorities.unpaidOrders.map((o) => (
              <Link
                key={o.id}
                href={`${baseHref}/socio/purchases`}
                className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full hover:bg-amber-200 transition-colors"
              >
                Pedido: {o.windowName} — {fmtCurrency(o.totalAmount)}
              </Link>
            ))}
            {priorities.unpaidEventPayments.map((ep) => (
              <Link
                key={ep.id}
                href={`${baseHref}/socio/events`}
                className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full hover:bg-amber-200 transition-colors"
              >
                Pago evento: {ep.eventTitle} — {fmtCurrency(ep.amount)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN GRID ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* UPCOMING EVENTS */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Calendar className="h-4 w-4 text-blue-500" />
                Próximos eventos
              </h3>
              <Link href={`${baseHref}/socio/events`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 pb-5">
              {upcomingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Calendar className="h-8 w-8 text-gray-200" />
                  <p className="text-sm text-gray-400">No hay eventos programados próximamente</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcomingEvents.map((event) => {
                    const typeConfig = getEventTypeConfig(event.type)
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-4 py-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors"
                      >
                        {/* Date block */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${typeConfig.bg} flex flex-col items-center justify-center`}>
                          <span className={`text-lg font-bold leading-none ${typeConfig.color}`}>
                            {fmtDay(event.startAt)}
                          </span>
                          <span className={`text-xs ${typeConfig.color} opacity-70`}>
                            {fmtMonth(event.startAt)}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                          {event.location && (
                            <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                        </div>

                        {/* Right: price + attendance */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                          <span className={`text-xs font-semibold ${event.price == null ? 'text-green-600' : 'text-gray-700'}`}>
                            {event.price == null ? 'Gratis' : fmtCurrency(event.price)}
                          </span>
                          {event.myAttendanceStatus === 'GOING' ? (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              ✓ Apuntado
                            </span>
                          ) : event.myAttendanceStatus === 'MAYBE' ? (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                              ? Tal vez
                            </span>
                          ) : (
                            <Link
                              href={`${baseHref}/socio/events`}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                            >
                              Apuntarse
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RECENT ORDERS */}
          {recentOrders.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ShoppingBag className="h-4 w-4 text-purple-500" />
                  Mis pedidos
                </h3>
                <Link href={`${baseHref}/socio/purchases`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  Ver todos <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="px-5 pb-5 divide-y divide-gray-50">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.windowName}</p>
                      <p className="text-xs text-gray-400">
                        {order.itemCount} artículo(s) · {fmtDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{fmtCurrency(order.totalAmount)}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Megaphone className="h-4 w-4 text-orange-500" />
                  Anuncios
                </h3>
                <Link href="#" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  Ver todos <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="px-5 pb-5 divide-y divide-gray-50">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`py-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors ${ann.pinned ? 'border-l-4 border-orange-400 pl-3' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {ann.pinned && <Pin className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">{ann.title}</p>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{ann.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{fmtDate(ann.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">

          {/* FINANCIAL STATUS */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Wallet className="h-4 w-4 text-emerald-500" />
                Estado financiero
              </h3>
              <Link href={`${baseHref}/socio/quotas`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                Ver historial <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 pb-5">
              {/* Summary */}
              <div className="mb-4">
                {stats.totalPendingAmount > 0 ? (
                  <p className="text-2xl font-bold text-orange-500">
                    {fmtCurrency(stats.totalPendingAmount)}
                    <span className="ml-1 text-sm font-normal text-orange-400">pendiente</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-lg font-bold text-green-600">
                    <CheckCircle2 className="h-5 w-5" /> Al día ✓
                  </p>
                )}
              </div>

              {/* Quotas list */}
              <div className="divide-y divide-gray-50">
                {quotas.slice(0, 4).map((q) => (
                  <div key={q.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Cuota {q.year}</p>
                      <p className="text-xs text-gray-400">{fmtCurrency(q.amount)}</p>
                    </div>
                    <QuotaStatusBadge status={q.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVE VOTES */}
          {activeVotes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <CheckSquare className="h-4 w-4 text-indigo-500" />
                  Votaciones
                </h3>
              </div>
              <div className="px-5 pb-5 divide-y divide-gray-50">
                {activeVotes.map((vote) => (
                  <div key={vote.id} className="py-3 space-y-2">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{vote.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {vote.totalResponses} voto(s)
                          {vote.status === 'active' && vote.endsAt && ` · Cierra ${fmtDate(vote.endsAt)}`}
                          {vote.status === 'closed' && vote.closedAt && ` · Cerrada ${fmtDate(vote.closedAt)}`}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                        {vote.status === 'active' && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            Abierta
                          </span>
                        )}
                        {vote.status === 'scheduled' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                            Programada
                          </span>
                        )}
                        {vote.status === 'closed' && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                            Cerrada
                          </span>
                        )}
                        {vote.status === 'active' && !vote.hasVoted && (
                          <Link
                            href={`${baseHref}/socio/votes`}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                          >
                            Votar
                          </Link>
                        )}
                        {vote.hasVoted && (
                          <span className="text-xs text-indigo-600 font-medium">Votado ✓</span>
                        )}
                      </div>
                    </div>

                    {/* Results bars */}
                    {vote.options.length > 0 && vote.totalResponses > 0 && (
                      <div className="space-y-1.5">
                        {vote.options.map((opt) => {
                          const pct = vote.totalResponses > 0 ? Math.round((opt.count / vote.totalResponses) * 100) : 0
                          const isMyVote = vote.myOptionId === opt.id
                          return (
                            <div key={opt.id}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`text-xs truncate ${isMyVote ? 'font-semibold text-indigo-700' : 'text-gray-600'}`}>
                                  {isMyVote && '✓ '}{opt.text}
                                </span>
                                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{pct}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isMyVote ? 'bg-indigo-500' : 'bg-gray-300'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* No votes yet message */}
                    {vote.totalResponses === 0 && vote.status === 'active' && !vote.hasVoted && (
                      <p className="text-xs text-gray-400 italic">Sé el primero en votar</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUICK ACTIONS */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 pt-5 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Zap className="h-4 w-4 text-yellow-500" />
                Accesos rápidos
              </h3>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-2">
              <Link
                href={`${baseHref}/socio/events`}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                <Calendar className="h-5 w-5 text-blue-500" />
                <span className="text-xs font-medium text-gray-700">Eventos</span>
              </Link>
              <Link
                href={`${baseHref}/socio/purchases`}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                <ShoppingCart className="h-5 w-5 text-purple-500" />
                <span className="text-xs font-medium text-gray-700">Pedidos</span>
              </Link>
              <Link
                href={`${baseHref}/socio/votes`}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                <CheckSquare className="h-5 w-5 text-indigo-500" />
                <span className="text-xs font-medium text-gray-700">Votaciones</span>
              </Link>
              <Link
                href={`${baseHref}/socio/support`}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                <LifeBuoy className="h-5 w-5 text-teal-500" />
                <span className="text-xs font-medium text-gray-700">Soporte</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
