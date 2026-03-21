'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { fmtDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  MapPin,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  Share2,
  Copy,
  Download,
  ExternalLink,
} from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

type EventType = 'TRAINING' | 'RACE' | 'SOCIAL' | 'MEETING' | 'TRIP' | 'OTHER'
type AttendeeStatus = 'GOING' | 'NOT_GOING' | 'MAYBE'
type ViewMode = 'calendar' | 'list'
type FilterMode = 'all' | 'mine'

interface Attachment {
  id: string
  name: string
  url: string
}

interface ClubEvent {
  id: string
  title: string
  description: string | null
  type: EventType
  location: string | null
  startAt: string
  endAt: string | null
  maxAttendees: number | null
  published: boolean
  imageUrl?: string | null
  _count: { attendees: number }
  attendees: { status: AttendeeStatus }[]
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }> = {
  TRAINING: { label: 'Entrenamiento', color: 'bg-green-500',  variant: 'success' },
  RACE:     { label: 'Carrera',       color: 'bg-amber-500',  variant: 'warning' },
  SOCIAL:   { label: 'Social',        color: 'bg-blue-500',   variant: 'info' },
  MEETING:  { label: 'Reunión',       color: 'bg-gray-500',   variant: 'default' },
  TRIP:     { label: 'Viaje',         color: 'bg-purple-500', variant: 'purple' },
  OTHER:    { label: 'Otro',          color: 'bg-gray-400',   variant: 'default' },
}

const RSVP_LABELS: Record<AttendeeStatus, string> = {
  GOING:     'Voy',
  NOT_GOING: 'No voy',
  MAYBE:     'Quizás',
}

const DOW_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function SocioEventsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<ViewMode>('calendar')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Detail modal
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachLoading, setAttachLoading] = useState(false)
  const [rsvpLoading, setRsvpLoading] = useState(false)

  // Share modal
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetchEvents = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/events?pageSize=200`)
    if (res.ok) {
      const d = await res.json()
      setEvents(d.data ?? d)
    }
    setLoading(false)
  }, [clubId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const calendarDays = (() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const startDow = (getDay(start) + 6) % 7 // Mon=0
    const prefix: null[] = Array(startDow).fill(null)
    return [...prefix, ...days]
  })()

  const eventsOnDay = (day: Date) =>
    events.filter((ev) => isSameDay(new Date(ev.startAt), day))

  // ── Filtered events for list view ─────────────────────────────────────────
  const filteredEvents = filter === 'mine'
    ? events.filter((ev) => ev.attendees[0]?.status)
    : events

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openDetail = async (ev: ClubEvent) => {
    setSelectedEvent(ev)
    setDetailOpen(true)
    setAttachments([])
    setAttachLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/events/${ev.id}/attachments`)
      if (res.ok) {
        const d = await res.json()
        setAttachments(d.data ?? d)
      }
    } finally {
      setAttachLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelectedEvent(null)
  }

  const handleRsvp = async (eventId: string, status: AttendeeStatus) => {
    setRsvpLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/events/${eventId}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        toast.success(status === 'GOING' ? '¡Apuntado!' : status === 'NOT_GOING' ? 'Marcado como no asistirás' : 'Respuesta guardada')
        const updateEvent = (ev: ClubEvent): ClubEvent => {
          if (ev.id !== eventId) return ev
          const wasGoing = ev.attendees[0]?.status === 'GOING'
          const nowGoing = status === 'GOING'
          const delta = wasGoing && !nowGoing ? -1 : !wasGoing && nowGoing ? 1 : 0
          return { ...ev, attendees: [{ status }], _count: { attendees: ev._count.attendees + delta } }
        }
        setEvents((prev) => prev.map(updateEvent))
        setSelectedEvent((prev) => prev ? updateEvent(prev) : prev)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al guardar respuesta')
      }
    } finally {
      setRsvpLoading(false)
    }
  }

  const openShare = async (ev: ClubEvent) => {
    setShareLink('')
    setShareOpen(true)
    setShareLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/events/${ev.id}/share`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        const token = d.shareToken ?? d.token ?? ''
        setShareLink(token ? `${window.location.origin}/events/shared/${token}` : '')
      }
    } finally {
      setShareLoading(false)
    }
  }

  const copyShareLink = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink).then(() => toast.success('Enlace copiado'))
  }

  // ── List: group by month ─────────────────────────────────────────────────
  const eventsByMonth: Record<string, ClubEvent[]> = {}
  for (const ev of filteredEvents) {
    const key = format(new Date(ev.startAt), 'MMMM yyyy', { locale: es })
    if (!eventsByMonth[key]) eventsByMonth[key] = []
    eventsByMonth[key].push(ev)
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Eventos" clubId={clubId} />
      <main className="flex-1 p-6 space-y-4">

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter tabs */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['all', 'mine'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-1.5 font-medium transition-colors',
                  filter === f ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {f === 'all' ? 'Todos' : 'Mis eventos'}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors',
                view === 'calendar' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendario
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors',
                view === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-16">Cargando eventos...</p>
        ) : view === 'calendar' ? (
          /* ── CALENDAR VIEW ── */
          <Card className="p-0 overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800 capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Hoy
                </button>
              </div>
              <button
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DOW_HEADERS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-[90px] border-b border-r border-gray-50" />
                }
                const dayEvents = eventsOnDay(day)
                const visible = dayEvents.slice(0, 3)
                const overflow = dayEvents.length - 3
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const today = isToday(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'min-h-[90px] p-1.5 border-b border-r border-gray-100',
                      !isCurrentMonth && 'bg-gray-50/50'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                        today
                          ? 'bg-primary text-white'
                          : isCurrentMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="space-y-0.5">
                      {visible.map((ev) => {
                        const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.OTHER
                        const userStatus = ev.attendees[0]?.status ?? null
                        return (
                          <button
                            key={ev.id}
                            onClick={() => openDetail(ev)}
                            className={cn(
                              'w-full flex items-center gap-1 px-1 py-0.5 rounded text-left text-[10px] font-medium text-white truncate',
                              cfg.color,
                              'hover:opacity-80 transition-opacity'
                            )}
                            title={ev.title}
                          >
                            {userStatus === 'GOING' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                            )}
                            {userStatus === 'MAYBE' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300 shrink-0" />
                            )}
                            <span className="truncate">{ev.title}</span>
                          </button>
                        )
                      })}
                      {overflow > 0 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{overflow} más</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ) : (
          /* ── LIST VIEW ── */
          filteredEvents.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-16">
                {filter === 'mine' ? 'No tienes eventos confirmados' : 'No hay próximos eventos'}
              </p>
            </Card>
          ) : (
            Object.entries(eventsByMonth).map(([month, monthEvents]) => (
              <section key={month}>
                <h2 className="text-base font-semibold text-gray-700 capitalize mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {month}
                </h2>
                <div className="space-y-3">
                  {monthEvents.map((ev) => {
                    const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.OTHER
                    const userStatus = ev.attendees[0]?.status ?? null
                    return (
                      <Card
                        key={ev.id}
                        className="p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openDetail(ev)}
                      >
                        <div className="flex items-start gap-4 p-4">
                          <div className="flex flex-col items-center min-w-[48px] text-center">
                            <span className="text-xs font-medium text-gray-400 uppercase">
                              {format(new Date(ev.startAt), 'MMM', { locale: es })}
                            </span>
                            <span className="text-2xl font-bold text-primary leading-none">
                              {format(new Date(ev.startAt), 'd')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                              {userStatus && (
                                <Badge variant={userStatus === 'GOING' ? 'success' : userStatus === 'MAYBE' ? 'warning' : 'default'}>
                                  {RSVP_LABELS[userStatus]}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{ev.title}</h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {fmtDateTime(ev.startAt)}
                                {ev.endAt && <> → {fmtDateTime(ev.endAt)}</>}
                              </span>
                              {ev.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {ev.location}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {ev._count.attendees} asistente(s)
                                {ev.maxAttendees ? ` / ${ev.maxAttendees} máx` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ))
          )
        )}
      </main>

      {/* ── Detail Modal ── */}
      {selectedEvent && (
        <Modal open={detailOpen} onClose={closeDetail} title={selectedEvent.title} size="lg">
          <div className="space-y-5">
            {/* Type + status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const cfg = EVENT_TYPE_CONFIG[selectedEvent.type] ?? EVENT_TYPE_CONFIG.OTHER
                const userStatus = selectedEvent.attendees[0]?.status ?? null
                return (
                  <>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    {userStatus && (
                      <Badge variant={userStatus === 'GOING' ? 'success' : userStatus === 'MAYBE' ? 'warning' : 'default'}>
                        {RSVP_LABELS[userStatus]}
                      </Badge>
                    )}
                    {!selectedEvent.published && <Badge variant="default">Borrador</Badge>}
                  </>
                )
              })()}
            </div>

            {/* Meta info */}
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span>
                  {fmtDateTime(selectedEvent.startAt)}
                  {selectedEvent.endAt && <> → {fmtDateTime(selectedEvent.endAt)}</>}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400 shrink-0" />
                <span>
                  {selectedEvent._count.attendees} asistente(s)
                  {selectedEvent.maxAttendees ? ` / ${selectedEvent.maxAttendees} máx` : ''}
                </span>
              </div>
            </div>

            {/* Description */}
            {selectedEvent.description && (
              <p className="text-sm text-gray-700 whitespace-pre-line">{selectedEvent.description}</p>
            )}

            {/* RSVP */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">¿Vas a este evento?</p>
              <div className="flex gap-2 flex-wrap">
                {(['GOING', 'MAYBE', 'NOT_GOING'] as AttendeeStatus[]).map((s) => {
                  const userStatus = selectedEvent.attendees[0]?.status ?? null
                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant={userStatus === s ? 'primary' : 'outline'}
                      loading={rsvpLoading}
                      onClick={() => handleRsvp(selectedEvent.id, s)}
                    >
                      {RSVP_LABELS[s]}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Attachments */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Adjuntos</p>
              {attachLoading ? (
                <p className="text-sm text-gray-400">Cargando adjuntos...</p>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-gray-400">Sin adjuntos</p>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      {att.name}
                      <ExternalLink className="h-3 w-3 text-gray-400" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Share */}
            <div className="flex pt-2 border-t border-gray-100">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  closeDetail()
                  setTimeout(() => openShare(selectedEvent), 50)
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Share Modal ── */}
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Compartir evento" size="md">
        <div className="space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Enlace compartible</p>
          {shareLoading ? (
            <p className="text-sm text-gray-400">Generando enlace...</p>
          ) : shareLink ? (
            <div className="flex gap-2">
              <input
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 outline-none"
              />
              <Button size="sm" variant="outline" onClick={copyShareLink}>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No se pudo generar el enlace</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
