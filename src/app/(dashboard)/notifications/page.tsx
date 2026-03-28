'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bell,
  Calendar,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  MessageCircle,
  ShoppingBag,
  Check,
} from 'lucide-react'
import { fmtRelative } from '@/lib/utils'
import type { NotificationType } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string | null
}

interface NotificationPreference {
  type: NotificationType
  inApp: boolean
  push: boolean
  email: boolean
}

type FilterTab = 'all' | 'unread' | 'events' | 'payments' | 'system'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<NotificationType, string> = {
  EVENT_REMINDER: 'Recordatorio de evento',
  PAYMENT_DUE: 'Pago pendiente',
  PAYMENT_RECEIVED: 'Pago confirmado',
  NEW_MEMBER: 'Nuevo socio',
  TICKET_REPLY: 'Respuesta en soporte',
  SYSTEM: 'Sistema',
  PURCHASE_UPDATE: 'Pedido actualizado',
}

const ALL_TYPES: NotificationType[] = [
  'EVENT_REMINDER',
  'PAYMENT_DUE',
  'PAYMENT_RECEIVED',
  'NEW_MEMBER',
  'TICKET_REPLY',
  'SYSTEM',
  'PURCHASE_UPDATE',
]

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Sin leer' },
  { id: 'events', label: 'Eventos' },
  { id: 'payments', label: 'Pagos' },
  { id: 'system', label: 'Sistema' },
]

// ─── Icon helper ──────────────────────────────────────────────────────────────

function TypeIcon({ type, size = 'md' }: { type: NotificationType; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  switch (type) {
    case 'EVENT_REMINDER':
      return <Calendar className={`${cls} text-blue-500`} />
    case 'PAYMENT_DUE':
      return <AlertCircle className={`${cls} text-red-500`} />
    case 'PAYMENT_RECEIVED':
      return <CheckCircle2 className={`${cls} text-green-500`} />
    case 'NEW_MEMBER':
      return <UserPlus className={`${cls} text-purple-500`} />
    case 'TICKET_REPLY':
      return <MessageCircle className={`${cls} text-indigo-500`} />
    case 'PURCHASE_UPDATE':
      return <ShoppingBag className={`${cls} text-orange-500`} />
    case 'SYSTEM':
    default:
      return <Bell className={`${cls} text-gray-500`} />
  }
}

function typeBgColor(type: NotificationType): string {
  switch (type) {
    case 'EVENT_REMINDER':
      return 'bg-blue-100'
    case 'PAYMENT_DUE':
      return 'bg-red-100'
    case 'PAYMENT_RECEIVED':
      return 'bg-green-100'
    case 'NEW_MEMBER':
      return 'bg-purple-100'
    case 'TICKET_REPLY':
      return 'bg-indigo-100'
    case 'PURCHASE_UPDATE':
      return 'bg-orange-100'
    case 'SYSTEM':
    default:
      return 'bg-gray-100'
  }
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [loadingPrefs, setLoadingPrefs] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Build filter params from active tab ────────────────────────────────────
  function buildParams(tab: FilterTab, page: number): string {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (tab === 'unread') params.set('unread', 'true')
    return params.toString()
  }

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (tab: FilterTab, page: number) => {
    setLoadingNotifs(true)
    try {
      const res = await fetch(`/api/notifications?${buildParams(tab, page)}`)
      if (res.ok) {
        const data = await res.json()
        let items: Notification[] = data.data ?? []

        // Client-side filter for type-based tabs (API doesn't support type filter yet)
        if (tab === 'events') {
          items = items.filter((n) => n.type === 'EVENT_REMINDER')
        } else if (tab === 'payments') {
          items = items.filter((n) => n.type === 'PAYMENT_DUE' || n.type === 'PAYMENT_RECEIVED')
        } else if (tab === 'system') {
          items = items.filter((n) => n.type === 'SYSTEM' || n.type === 'TICKET_REPLY')
        }

        setNotifications(items)
        setTotalPages(data.totalPages ?? 1)
        setUnreadCount(data.unreadCount ?? 0)
      }
    } finally {
      setLoadingNotifs(false)
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    fetchNotifications(activeTab, 1)
  }, [activeTab, fetchNotifications])

  // ── Fetch preferences ──────────────────────────────────────────────────────
  const fetchPreferences = useCallback(async () => {
    setLoadingPrefs(true)
    try {
      const res = await fetch('/api/notifications/preferences')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences ?? [])
      }
    } finally {
      setLoadingPrefs(false)
    }
  }, [])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  // ── Mark single as read ────────────────────────────────────────────────────
  const markRead = async (notifId: string) => {
    await fetch(`/api/notifications/${notifId}/read`, { method: 'POST' })
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  // ── Mark all as read ───────────────────────────────────────────────────────
  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  // ── Toggle preference ──────────────────────────────────────────────────────
  const handlePreferenceToggle = (
    type: NotificationType,
    channel: 'inApp' | 'push' | 'email',
    value: boolean
  ) => {
    setPreferences((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [channel]: value } : p))
    )

    // Debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const updated = preferences.map((p) =>
        p.type === type ? { ...p, [channel]: value } : p
      )
      try {
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
      } catch {
        // Ignore save errors silently
      }
    }, 500)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchNotifications(activeTab, page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {unreadCount} sin leer
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Check className="h-4 w-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        {loadingNotifs ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Bell className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No hay notificaciones</p>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === 'unread'
                ? 'Estás al día con todas tus notificaciones.'
                : 'Aquí aparecerán tus notificaciones.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                  !n.read ? 'bg-blue-50/40' : ''
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${typeBgColor(n.type)}`}
                >
                  <TypeIcon type={n.type} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-tight ${
                        !n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
                      }`}
                    >
                      {n.title}
                    </p>
                    <span className="flex-shrink-0 text-[11px] text-gray-400 mt-0.5">
                      {fmtRelative(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  {n.link && (
                    <a
                      href={n.link}
                      onClick={(e) => {
                        e.preventDefault()
                        if (!n.read) markRead(n.id)
                        window.location.href = n.link!
                      }}
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Ver detalle →
                    </a>
                  )}
                </div>

                {/* Mark read button */}
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    title="Marcar como leída"
                    className="flex-shrink-0 p-1 text-gray-300 hover:text-blue-500 rounded transition-colors mt-0.5"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mb-10">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Preferences section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Preferencias de notificación</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Elige cómo quieres recibir cada tipo de notificación.
          </p>
        </div>

        {loadingPrefs ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-center">
                    En la app
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-center">
                    Push
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-center">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preferences.length > 0
                  ? preferences.map((pref) => (
                      <tr key={pref.type} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <TypeIcon type={pref.type} size="sm" />
                            <span className="text-sm text-gray-700">{TYPE_LABELS[pref.type]}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Toggle
                              checked={pref.inApp}
                              onChange={(v) => handlePreferenceToggle(pref.type, 'inApp', v)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Toggle
                              checked={pref.push}
                              onChange={(v) => handlePreferenceToggle(pref.type, 'push', v)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Toggle
                              checked={pref.email}
                              onChange={(v) => handlePreferenceToggle(pref.type, 'email', v)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  : ALL_TYPES.map((type) => (
                      <tr key={type} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <TypeIcon type={type} size="sm" />
                            <span className="text-sm text-gray-700">{TYPE_LABELS[type]}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Toggle checked={true} onChange={() => {}} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Toggle checked={true} onChange={() => {}} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Toggle checked={false} onChange={() => {}} />
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
