'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { fmtDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MapPin, Users, Calendar, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type EventType = 'TRAINING' | 'RACE' | 'SOCIAL' | 'MEETING' | 'TRIP' | 'OTHER'
type AttendeeStatus = 'GOING' | 'NOT_GOING' | 'MAYBE'

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
  _count: { attendees: number }
  attendees: { status: AttendeeStatus }[]
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }> = {
  TRAINING: { label: 'Entrenamiento', variant: 'success' },
  RACE:     { label: 'Carrera',       variant: 'warning' },
  SOCIAL:   { label: 'Social',        variant: 'info' },
  MEETING:  { label: 'Reunión',       variant: 'default' },
  TRIP:     { label: 'Viaje',         variant: 'purple' },
  OTHER:    { label: 'Otro',          variant: 'default' },
}

const RSVP_LABELS: Record<AttendeeStatus, string> = {
  GOING:     'Voy',
  NOT_GOING: 'No voy',
  MAYBE:     'Quizás',
}

export default function SocioEventsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetchEvents = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/events?upcoming=true&pageSize=100`)
    if (res.ok) {
      const d = await res.json()
      setEvents(d.data ?? [])
    }
    setLoading(false)
  }, [clubId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleRsvp = async (eventId: string, status: AttendeeStatus) => {
    setRsvpLoading((prev) => ({ ...prev, [eventId]: true }))
    try {
      const res = await fetch(`/api/clubs/${clubId}/events/${eventId}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        toast.success(status === 'GOING' ? '¡Apuntado!' : status === 'NOT_GOING' ? 'Marcado como no asistirás' : 'Respuesta guardada')
        // Optimistically update local state
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id !== eventId) return ev
            const prevStatus = ev.attendees[0]?.status
            const wasGoing = prevStatus === 'GOING'
            const nowGoing = status === 'GOING'
            const countDelta = wasGoing && !nowGoing ? -1 : !wasGoing && nowGoing ? 1 : 0
            return {
              ...ev,
              attendees: [{ status }],
              _count: { attendees: ev._count.attendees + countDelta },
            }
          })
        )
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al guardar respuesta')
      }
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [eventId]: false }))
    }
  }

  // Group events by month
  const eventsByMonth: Record<string, ClubEvent[]> = {}
  for (const ev of events) {
    const key = format(new Date(ev.startAt), 'MMMM yyyy', { locale: es })
    if (!eventsByMonth[key]) eventsByMonth[key] = []
    eventsByMonth[key].push(ev)
  }

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Eventos" clubId={clubId} />
      <main className="flex-1 p-6 space-y-8">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-16">Cargando eventos...</p>
        ) : events.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-16">No hay próximos eventos</p>
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
                  const cfg = EVENT_TYPE_CONFIG[ev.type] ?? { label: ev.type, variant: 'default' as const }
                  const userStatus = ev.attendees[0]?.status ?? null
                  const isExpanded = expanded[ev.id]

                  return (
                    <Card key={ev.id} className="p-0 overflow-hidden">
                      {/* Header row */}
                      <div className="flex items-start gap-4 p-4">
                        {/* Date column */}
                        <div className="flex flex-col items-center min-w-[48px] text-center">
                          <span className="text-xs font-medium text-gray-400 uppercase">
                            {format(new Date(ev.startAt), 'MMM', { locale: es })}
                          </span>
                          <span className="text-2xl font-bold text-primary leading-none">
                            {format(new Date(ev.startAt), 'd')}
                          </span>
                        </div>

                        {/* Content */}
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

                        {/* Expand toggle */}
                        {ev.description && (
                          <button
                            onClick={() => toggleExpand(ev.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>

                      {/* Expanded description */}
                      {isExpanded && ev.description && (
                        <div className="px-4 pb-3 text-sm text-gray-600 border-t border-gray-50 pt-3">
                          {ev.description}
                        </div>
                      )}

                      {/* RSVP row */}
                      <div className="flex items-center gap-2 px-4 pb-4 pt-1">
                        <span className="text-xs text-gray-400 mr-1">¿Vas?</span>
                        {(['GOING', 'MAYBE', 'NOT_GOING'] as AttendeeStatus[]).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={userStatus === s ? 'primary' : 'outline'}
                            loading={rsvpLoading[ev.id]}
                            onClick={() => handleRsvp(ev.id, s)}
                          >
                            {RSVP_LABELS[s]}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
