'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Calendar,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  MessageCircle,
  ShoppingBag,
  X,
} from 'lucide-react'
import { fmtRelative } from '@/lib/utils'
import type { NotificationType } from '@prisma/client'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string | null
}

const TYPE_LABELS: Record<NotificationType, string> = {
  EVENT_REMINDER: 'Recordatorio de evento',
  PAYMENT_DUE: 'Pago pendiente',
  PAYMENT_RECEIVED: 'Pago confirmado',
  NEW_MEMBER: 'Nuevo socio',
  TICKET_REPLY: 'Respuesta en soporte',
  SYSTEM: 'Sistema',
  PURCHASE_UPDATE: 'Pedido actualizado',
}

interface TypeIconProps {
  type: NotificationType
}

function TypeIcon({ type }: TypeIconProps) {
  switch (type) {
    case 'EVENT_REMINDER':
      return <Calendar className="h-4 w-4 text-blue-500" />
    case 'PAYMENT_DUE':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'PAYMENT_RECEIVED':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'NEW_MEMBER':
      return <UserPlus className="h-4 w-4 text-purple-500" />
    case 'TICKET_REPLY':
      return <MessageCircle className="h-4 w-4 text-indigo-500" />
    case 'PURCHASE_UPDATE':
      return <ShoppingBag className="h-4 w-4 text-orange-500" />
    case 'SYSTEM':
    default:
      return <Bell className="h-4 w-4 text-gray-500" />
  }
}

export function NotificationBell(_props?: { clubId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?pageSize=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // Silently ignore fetch errors in background polling
    }
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&pageSize=1')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // Silently ignore fetch errors in background polling
    }
  }, [])

  // Poll unread count every 60s
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // Ignore
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'POST' })
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // Ignore
      }
    }

    if (notification.link) {
      setOpen(false)
      router.push(notification.link)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notificaciones"
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notificaciones</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Marcar todas como leídas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell className="h-8 w-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                    !n.read ? 'bg-blue-50/50' : 'bg-white'
                  }`}
                >
                  {/* Blue dot for unread */}
                  <div className="flex-shrink-0 mt-0.5">
                    {!n.read ? (
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                    ) : (
                      <div className="h-2 w-2" />
                    )}
                  </div>

                  {/* Type icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    <TypeIcon type={n.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${
                        !n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{fmtRelative(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <a
              href="/notifications"
              className="block text-center text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
              onClick={() => setOpen(false)}
            >
              Ver todas
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
