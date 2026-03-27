'use client'
/**
 * FIXES aplicados:
 *  1. fetchNotifications envuelto en useCallback con [clubId] como dep →
 *     ya no se recrea en cada render, el intervalo siempre llama a la versión actual.
 *  2. Intervalo limpiado al desmontar (ya estaba, se mantiene).
 *  3. La función no se ejecuta si clubId no está disponible.
 *  4. Se evita llamar fetch al abrir si los datos son recientes (< 10s).
 */
import { Bell } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { fmtRelative } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
}

const POLL_INTERVAL = 30_000
const STALE_THRESHOLD = 10_000 // don't re-fetch if data is < 10s old

export function NotificationBell({ clubId }: { clubId?: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const lastFetchedAt = useRef<number>(0)

  const fetchNotifications = useCallback(async () => {
    if (!clubId) return
    try {
      const res = await fetch(`/api/notifications?clubId=${clubId}&pageSize=10`)
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.data)
      setUnreadCount(data.unreadCount)
      lastFetchedAt.current = Date.now()
    } catch {
      // Network errors are non-fatal for the notification bell
    }
  }, [clubId])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNotifications])   // ← dep correcto: clubId indirectamente via fetchNotifications

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleOpen = () => {
    const willOpen = !open
    setOpen(willOpen)
    // Only re-fetch on open if data is stale (> 10s old)
    if (willOpen && Date.now() - lastFetchedAt.current > STALE_THRESHOLD) {
      fetchNotifications()
    }
  }

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({}) })
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
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
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Marcar todo como leído
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin notificaciones</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{fmtRelative(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
