'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { fmtDate, fmtDateTime } from '@/lib/utils'
import { Mail, MailOpen, Inbox, CheckCheck } from 'lucide-react'

interface InboxItem {
  id: string
  read: boolean
  readAt: string | null
  message: {
    id: string
    subject: string
    body: string
    sentAt: string | null
    sender: {
      id: string
      name: string
    }
  }
}

export default function SocioInboxPage() {
  const { clubId } = useClub()
  const [items, setItems] = useState<InboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)

  const fetchInbox = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/messages/inbox?pageSize=50`)
      if (res.ok) {
        const d = await res.json()
        setItems(d.data ?? [])
        setUnreadCount(d.unreadCount ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => { fetchInbox() }, [fetchInbox])

  const markAsRead = async (messageId: string) => {
    await fetch(`/api/clubs/${clubId}/messages/inbox`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })
  }

  const openMessage = async (item: InboxItem) => {
    setSelectedItem(item)
    if (!item.read) {
      // Optimistically mark as read
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, read: true, readAt: new Date().toISOString() } : i
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      // Fire and forget
      markAsRead(item.message.id)
    }
  }

  const markAllRead = async () => {
    const res = await fetch(`/api/clubs/${clubId}/messages/inbox`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      setItems((prev) => prev.map((i) => ({ ...i, read: true })))
      setUnreadCount(0)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Bandeja de entrada" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Mensajes</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="info">{unreadCount} sin leer</Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todos como leídos
              </Button>
            )}
          </CardHeader>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-12">Cargando mensajes...</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <Inbox className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Tu bandeja de entrada está vacía</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openMessage(item)}
                  className={`w-full flex items-start gap-3 py-3.5 px-2 hover:bg-gray-50 rounded-lg transition-colors text-left ${!item.read ? 'bg-blue-50/30' : ''}`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.read ? (
                      <MailOpen className="h-4 w-4 text-gray-300" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm truncate ${!item.read ? 'font-semibold text-gray-900' : 'font-normal text-gray-600'}`}>
                        {item.message.subject}
                      </span>
                      {!item.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      De: {item.message.sender?.name ?? 'Administración'}
                    </p>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {item.message.sentAt ? fmtDate(item.message.sentAt) : '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </main>

      {/* Message detail modal */}
      <Modal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.message.subject ?? ''}
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500 border-b border-gray-100 pb-3">
              <span>
                De: <span className="font-medium text-gray-700">{selectedItem.message.sender?.name ?? 'Administración'}</span>
              </span>
              {selectedItem.message.sentAt && (
                <span>{fmtDateTime(selectedItem.message.sentAt)}</span>
              )}
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[120px]">
              {selectedItem.message.body}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedItem(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
