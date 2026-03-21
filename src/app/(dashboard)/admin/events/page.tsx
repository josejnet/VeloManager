'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { fmtDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  Edit2,
  Share2,
  Paperclip,
  Download,
  Copy,
  Mail,
  X,
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

interface ClubEvent {
  id: string
  title: string
  description: string | null
  type: EventType
  location: string | null
  startAt: string
  endAt: string | null
  maxAttendees: number | null
  imageUrl: string | null
  published: boolean
  _count?: { attendees: number }
  attendees?: { id: string; user: { name: string | null; email: string } }[]
}

interface Attachment {
  id: string
  name: string
  url: string
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple'; pill: string }> = {
  TRAINING: { label: 'Entrenamiento', variant: 'success',  pill: 'bg-green-500' },
  RACE:     { label: 'Carrera',       variant: 'warning',  pill: 'bg-amber-500' },
  SOCIAL:   { label: 'Social',        variant: 'info',     pill: 'bg-blue-500' },
  MEETING:  { label: 'Reunión',       variant: 'default',  pill: 'bg-gray-400' },
  TRIP:     { label: 'Viaje',         variant: 'purple',   pill: 'bg-purple-500' },
  OTHER:    { label: 'Otro',          variant: 'default',  pill: 'bg-gray-400' },
}

const defaultForm = {
  title: '',
  description: '',
  type: 'TRAINING' as EventType,
  location: '',
  startAt: '',
  endAt: '',
  maxAttendees: '',
  imageUrl: '',
  published: false,
}

type ViewMode = 'calendar' | 'list'
type ModalMode = 'create' | 'edit' | 'detail' | 'share' | null

export default function AdminEventsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<ViewMode>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  // Detail modal
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachLoading, setAttachLoading] = useState(false)
  const [newAttachName, setNewAttachName] = useState('')
  const [newAttachUrl, setNewAttachUrl] = useState('')
  const [addingAttach, setAddingAttach] = useState(false)

  // Share modal
  const [shareLink, setShareLink] = useState('')
  const [shareEmails, setShareEmails] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [shareSending, setShareSending] = useState(false)
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
    // getDay: 0=Sun, 1=Mon...6=Sat → convert to Mon-first offset (0=Mon)
    const startDow = (getDay(start) + 6) % 7 // Mon=0
    const prefixDays: null[] = Array(startDow).fill(null)
    return [...prefixDays, ...days]
  })()

  const eventsOnDay = (day: Date) =>
    events.filter((ev) => isSameDay(new Date(ev.startAt), day))

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(defaultForm)
    setModalMode('create')
  }

  const openDetail = async (ev: ClubEvent) => {
    setSelectedEvent(ev)
    setModalMode('detail')
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

  const openEdit = (ev: ClubEvent) => {
    setSelectedEvent(ev)
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      type: ev.type,
      location: ev.location ?? '',
      startAt: ev.startAt ? ev.startAt.slice(0, 16) : '',
      endAt: ev.endAt ? ev.endAt.slice(0, 16) : '',
      maxAttendees: ev.maxAttendees?.toString() ?? '',
      imageUrl: ev.imageUrl ?? '',
      published: ev.published,
    })
    setModalMode('edit')
  }

  const openShare = async (ev: ClubEvent) => {
    setSelectedEvent(ev)
    setShareLink('')
    setShareEmails('')
    setShareMessage('')
    setModalMode('share')
    setShareLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/events/${ev.id}/share`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setShareLink(d.shareUrl ?? d.url ?? `${window.location.origin}/events/share/${d.shareToken}`)
      } else {
        toast.error('No se pudo obtener el enlace')
      }
    } finally {
      setShareLoading(false)
    }
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedEvent(null)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!form.title || !form.startAt) return toast.error('El título y la fecha de inicio son obligatorios')
    setSubmitting(true)
    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      location: form.location || null,
      startAt: form.startAt,
      endAt: form.endAt || null,
      imageUrl: form.imageUrl || null,
      published: form.published,
    }
    if (form.maxAttendees) body.maxAttendees = parseInt(form.maxAttendees)
    const res = await fetch(`/api/clubs/${clubId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success('Evento creado')
      closeModal()
      fetchEvents()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al crear evento')
    }
    setSubmitting(false)
  }

  const submitEdit = async () => {
    if (!selectedEvent) return
    if (!form.title || !form.startAt) return toast.error('El título y la fecha de inicio son obligatorios')
    setSubmitting(true)
    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      location: form.location || null,
      startAt: form.startAt,
      endAt: form.endAt || null,
      imageUrl: form.imageUrl || null,
      published: form.published,
    }
    if (form.maxAttendees) body.maxAttendees = parseInt(form.maxAttendees)
    const res = await fetch(`/api/clubs/${clubId}/events/${selectedEvent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success('Evento actualizado')
      closeModal()
      fetchEvents()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al actualizar')
    }
    setSubmitting(false)
  }

  const togglePublish = async (ev: ClubEvent) => {
    const res = await fetch(`/api/clubs/${clubId}/events/${ev.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !ev.published }),
    })
    if (res.ok) {
      toast.success(ev.published ? 'Evento ocultado' : 'Evento publicado')
      fetchEvents()
      if (selectedEvent?.id === ev.id) {
        setSelectedEvent((prev) => prev ? { ...prev, published: !prev.published } : null)
      }
    } else {
      toast.error('Error al actualizar')
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return
    const res = await fetch(`/api/clubs/${clubId}/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Evento eliminado')
      closeModal()
      fetchEvents()
    } else {
      toast.error('Error al eliminar')
    }
  }

  // ── Attachments ───────────────────────────────────────────────────────────
  const addAttachment = async () => {
    if (!selectedEvent || !newAttachName || !newAttachUrl) return
    setAddingAttach(true)
    const res = await fetch(`/api/clubs/${clubId}/events/${selectedEvent.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAttachName, url: newAttachUrl }),
    })
    if (res.ok) {
      const d = await res.json()
      setAttachments((prev) => [...prev, d])
      setNewAttachName('')
      setNewAttachUrl('')
      toast.success('Adjunto añadido')
    } else {
      toast.error('Error al añadir adjunto')
    }
    setAddingAttach(false)
  }

  const deleteAttachment = async (attachId: string) => {
    if (!selectedEvent) return
    const res = await fetch(`/api/clubs/${clubId}/events/${selectedEvent.id}/attachments/${attachId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== attachId))
      toast.success('Adjunto eliminado')
    } else {
      toast.error('Error al eliminar adjunto')
    }
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const sendShareEmails = async () => {
    if (!selectedEvent || !shareEmails.trim()) return
    setShareSending(true)
    const emails = shareEmails.split(',').map((e) => e.trim()).filter(Boolean)
    const res = await fetch(`/api/clubs/${clubId}/events/${selectedEvent.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, message: shareMessage || undefined }),
    })
    if (res.ok) {
      toast.success('Invitaciones enviadas')
      setShareEmails('')
      setShareMessage('')
    } else {
      toast.error('Error al enviar invitaciones')
    }
    setShareSending(false)
  }

  // ── Form component ────────────────────────────────────────────────────────
  const EventForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <Input
        label="Título *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Nombre del evento"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          placeholder="Descripción del evento (opcional)"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as EventType })}
          options={[
            { value: 'TRAINING', label: 'Entrenamiento' },
            { value: 'RACE',     label: 'Carrera' },
            { value: 'SOCIAL',   label: 'Social' },
            { value: 'MEETING',  label: 'Reunión' },
            { value: 'TRIP',     label: 'Viaje' },
            { value: 'OTHER',    label: 'Otro' },
          ]}
        />
        <Input
          label="Lugar"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="Ubicación"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Inicio *"
          type="datetime-local"
          value={form.startAt}
          onChange={(e) => setForm({ ...form, startAt: e.target.value })}
        />
        <Input
          label="Fin"
          type="datetime-local"
          value={form.endAt}
          onChange={(e) => setForm({ ...form, endAt: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Aforo máximo"
          type="number"
          value={form.maxAttendees}
          onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
          placeholder="Sin límite"
        />
        <Input
          label="URL de imagen"
          type="url"
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
          className="rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm text-gray-700">Publicar inmediatamente</span>
      </label>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={onSubmit} loading={submitting}>{submitLabel}</Button>
        <Button variant="outline" className="flex-1" onClick={closeModal}>Cancelar</Button>
      </div>
    </div>
  )

  // ── List view grouped by month ────────────────────────────────────────────
  const eventsByMonth: Record<string, ClubEvent[]> = {}
  const sortedEvents = [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  for (const ev of sortedEvents) {
    const key = format(new Date(ev.startAt), 'MMMM yyyy', { locale: es })
    if (!eventsByMonth[key]) eventsByMonth[key] = []
    eventsByMonth[key].push(ev)
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Eventos" clubId={clubId} />
      <main className="flex-1 p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 bg-white">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                view === 'calendar' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Calendario
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                view === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo evento
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-16">Cargando eventos...</p>
        ) : view === 'calendar' ? (
          /* ── Calendar view ── */
          <Card padding="none" className="overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <button
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900 capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Hoy
                </button>
              </div>
              <button
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-[90px] border-b border-r border-gray-50 bg-gray-50/50" />
                }
                const dayEvents = eventsOnDay(day)
                const visible = dayEvents.slice(0, 3)
                const overflow = dayEvents.length - 3
                const todayCell = isToday(day)
                const inMonth = isSameMonth(day, currentMonth)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'min-h-[90px] p-1.5 border-b border-r border-gray-100 flex flex-col',
                      !inMonth && 'bg-gray-50/40'
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium self-start w-6 h-6 flex items-center justify-center rounded-full mb-1',
                        todayCell
                          ? 'bg-primary text-white'
                          : inMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {visible.map((ev) => {
                        const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.OTHER
                        return (
                          <button
                            key={ev.id}
                            onClick={() => openDetail(ev)}
                            className={cn(
                              'w-full text-left text-white text-[10px] font-medium px-1.5 py-0.5 rounded truncate leading-tight',
                              cfg.pill,
                              'hover:opacity-80 transition-opacity'
                            )}
                            title={ev.title}
                          >
                            {ev.title}
                          </button>
                        )
                      })}
                      {overflow > 0 && (
                        <span className="text-[10px] text-gray-400 px-1">+{overflow} más</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ) : (
          /* ── List view ── */
          events.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-12">No hay eventos. Crea el primero.</p>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(eventsByMonth).map(([month, monthEvents]) => (
                <section key={month}>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2 capitalize">
                    <Calendar className="h-4 w-4 text-primary" />
                    {month}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {monthEvents.map((ev) => {
                      const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.OTHER
                      return (
                        <Card key={ev.id} className="flex flex-col cursor-pointer hover:shadow-md transition-shadow" padding="none">
                          <button className="flex flex-col flex-1 text-left p-4" onClick={() => openDetail(ev)}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                              <Badge variant={ev.published ? 'success' : 'default'}>
                                {ev.published ? 'Publicado' : 'Borrador'}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-gray-900 text-base leading-snug mb-1">{ev.title}</h3>
                            {ev.description && (
                              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ev.description}</p>
                            )}
                            <div className="space-y-1 text-xs text-gray-500 mt-auto">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                <span>{fmtDateTime(ev.startAt)}</span>
                                {ev.endAt && <span>→ {fmtDateTime(ev.endAt)}</span>}
                              </div>
                              {ev.location && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{ev.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {ev._count?.attendees ?? 0} asistentes
                                  {ev.maxAttendees ? ` / ${ev.maxAttendees} máx` : ''}
                                </span>
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 px-4 pb-4 pt-2 border-t border-gray-100">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}>
                              <Edit2 className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => togglePublish(ev)}>
                              {ev.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {ev.published ? 'Ocultar' : 'Publicar'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                              onClick={() => deleteEvent(ev.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )
        )}
      </main>

      {/* ── Create Modal ── */}
      <Modal open={modalMode === 'create'} onClose={closeModal} title="Nuevo evento" size="lg">
        <EventForm onSubmit={submitCreate} submitLabel="Crear evento" />
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal open={modalMode === 'edit'} onClose={closeModal} title="Editar evento" size="lg">
        <EventForm onSubmit={submitEdit} submitLabel="Guardar cambios" />
      </Modal>

      {/* ── Detail Modal ── */}
      {selectedEvent && (
        <Modal open={modalMode === 'detail'} onClose={closeModal} title={selectedEvent.title} size="xl">
          <div className="space-y-5">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const cfg = EVENT_TYPE_CONFIG[selectedEvent.type] ?? EVENT_TYPE_CONFIG.OTHER
                return <Badge variant={cfg.variant}>{cfg.label}</Badge>
              })()}
              <Badge variant={selectedEvent.published ? 'success' : 'default'}>
                {selectedEvent.published ? 'Publicado' : 'Borrador'}
              </Badge>
            </div>

            {/* Info */}
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{fmtDateTime(selectedEvent.startAt)}{selectedEvent.endAt ? ` → ${fmtDateTime(selectedEvent.endAt)}` : ''}</span>
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
                  {selectedEvent._count?.attendees ?? 0} asistentes
                  {selectedEvent.maxAttendees ? ` / ${selectedEvent.maxAttendees} máx` : ''}
                </span>
              </div>
            </div>

            {selectedEvent.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{selectedEvent.description}</p>
            )}

            {/* Attendees list */}
            {(selectedEvent.attendees?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Asistentes</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedEvent.attendees?.map((a) => (
                    <div key={a.id} className="text-sm text-gray-700">
                      {a.user.name ?? a.user.email}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Adjuntos
              </h4>
              {attachLoading ? (
                <p className="text-xs text-gray-400">Cargando adjuntos...</p>
              ) : attachments.length === 0 ? (
                <p className="text-xs text-gray-400">Sin adjuntos</p>
              ) : (
                <div className="space-y-1 mb-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline flex-1 min-w-0 truncate"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        {a.name}
                      </a>
                      <button
                        onClick={() => deleteAttachment(a.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add attachment */}
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Nombre"
                  value={newAttachName}
                  onChange={(e) => setNewAttachName(e.target.value)}
                />
                <Input
                  placeholder="URL"
                  value={newAttachUrl}
                  onChange={(e) => setNewAttachUrl(e.target.value)}
                />
                <Button size="sm" onClick={addAttachment} loading={addingAttach} disabled={!newAttachName || !newAttachUrl}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <Button size="sm" variant="outline" onClick={() => { closeModal(); setTimeout(() => openEdit(selectedEvent), 50) }}>
                <Edit2 className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => togglePublish(selectedEvent)}>
                {selectedEvent.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {selectedEvent.published ? 'Ocultar' : 'Publicar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { closeModal(); setTimeout(() => openShare(selectedEvent), 50) }}>
                <Share2 className="h-3.5 w-3.5" />
                Compartir
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="ml-auto"
                onClick={() => deleteEvent(selectedEvent.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Share Modal ── */}
      {selectedEvent && (
        <Modal open={modalMode === 'share'} onClose={closeModal} title="Compartir evento" size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Enlace compartible</label>
              {shareLoading ? (
                <p className="text-sm text-gray-400">Generando enlace...</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareLink}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={copyShareLink} disabled={!shareLink}>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Enviar invitación por email</label>
              <Input
                placeholder="email@ejemplo.com, otro@ejemplo.com"
                value={shareEmails}
                onChange={(e) => setShareEmails(e.target.value)}
              />
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Mensaje personalizado..."
                />
              </div>
              <Button
                className="w-full mt-2"
                onClick={sendShareEmails}
                loading={shareSending}
                disabled={!shareEmails.trim()}
              >
                <Mail className="h-4 w-4" />
                Enviar invitaciones
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
