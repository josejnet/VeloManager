'use client'
/**
 * EmergencyAnnouncementModal
 *
 * Polls for unread/unconfirmed announcements every 60 s.
 * Shows them one at a time, highest priority first.
 *
 * - EMERGENCY announcements: red banner, cannot be dismissed without confirming.
 * - NORMAL + requiresConfirmation: blue banner, requires explicit confirmation.
 * - NORMAL (no confirmation): shows a single "Entendido" dismiss button that
 *   still marks the announcement as read so it won't reappear.
 */

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Bell, Check, ChevronRight, FileText, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtDateTime } from '@/lib/utils'

interface PendingAnnouncement {
  id: string
  clubId: string
  title: string
  body: string
  imageUrl: string | null
  priority: 'NORMAL' | 'EMERGENCY'
  requiresConfirmation: boolean
  publishAt: string
  sharedFiles: { id: string; name: string; url: string }[]
}

interface Props {
  clubId: string
}

const POLL_INTERVAL = 60_000 // 1 minute

export function EmergencyAnnouncementModal({ clubId }: Props) {
  const [queue, setQueue] = useState<PendingAnnouncement[]>([])
  const [confirming, setConfirming] = useState(false)

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/announcements/pending`)
      if (!res.ok) return
      const data: PendingAnnouncement[] = await res.json()
      setQueue(data)
    } catch {
      // silent — network errors shouldn't break the app
    }
  }, [clubId])

  // Initial fetch + polling
  useEffect(() => {
    fetchPending()
    const id = setInterval(fetchPending, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchPending])

  const current = queue[0] ?? null
  if (!current) return null

  const isEmergency = current.priority === 'EMERGENCY'
  const mustConfirm = isEmergency || current.requiresConfirmation

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await fetch(`/api/clubs/${current.clubId}/announcements/${current.id}/read`, {
        method: 'POST',
      })
      // Remove from queue and re-fetch to stay in sync
      setQueue((prev) => prev.filter((a) => a.id !== current.id))
      await fetchPending()
    } finally {
      setConfirming(false)
    }
  }

  const handleDismiss = async () => {
    // For non-mandatory announcements, mark as read silently on dismiss
    await fetch(`/api/clubs/${current.clubId}/announcements/${current.id}/read`, {
      method: 'POST',
    })
    setQueue((prev) => prev.filter((a) => a.id !== current.id))
  }

  return (
    // Full-screen overlay — blocks interaction for EMERGENCY, semi-transparent otherwise
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4',
        isEmergency ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/40 backdrop-blur-sm'
      )}
      // Only allow clicking backdrop to close non-mandatory announcements
      onClick={mustConfirm ? undefined : handleDismiss}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header stripe */}
        <div
          className={cn(
            'flex items-center gap-3 px-6 py-4 rounded-t-2xl',
            isEmergency
              ? 'bg-red-600 text-white'
              : 'bg-primary text-white'
          )}
        >
          {isEmergency ? (
            <AlertTriangle className="h-6 w-6 flex-shrink-0 animate-pulse" />
          ) : (
            <Bell className="h-6 w-6 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              {isEmergency ? 'Comunicado urgente' : 'Anuncio del club'}
            </p>
            <p className="font-bold text-base leading-tight truncate">{current.title}</p>
          </div>
          {/* Queue counter */}
          {queue.length > 1 && (
            <span className="flex-shrink-0 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {queue.length} pendientes
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Image */}
          {current.imageUrl && (
            <img
              src={current.imageUrl}
              alt=""
              className="w-full rounded-xl object-cover max-h-48"
            />
          )}

          {/* Body */}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{current.body}</p>

          {/* Attached files */}
          {current.sharedFiles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Archivos adjuntos</p>
              {current.sharedFiles.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{f.name}</span>
                </a>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">{fmtDateTime(current.publishAt)}</p>
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-5 flex gap-3">
          {mustConfirm ? (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-colors',
                isEmergency
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-primary hover:bg-primary-dark text-white'
              )}
            >
              <Check className="h-4 w-4" />
              {confirming ? 'Confirmando…' : 'He leído y entendido este comunicado'}
            </button>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
              >
                <X className="h-4 w-4" />
                Cerrar
              </button>
              {queue.length > 1 && (
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-1.5 px-4 py-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-semibold text-sm transition-colors"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
