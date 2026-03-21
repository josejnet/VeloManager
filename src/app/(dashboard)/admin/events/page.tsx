'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { fmtDate, fmtDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Trash2, Eye, EyeOff, MapPin, Users, Calendar } from 'lucide-react'

type EventType = 'TRAINING' | 'RACE' | 'SOCIAL' | 'MEETING' | 'TRIP'

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
  _count?: { attendees: number }
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }> = {
  TRAINING: { label: 'Entrenamiento', variant: 'success' },
  RACE:     { label: 'Carrera',       variant: 'warning' },
  SOCIAL:   { label: 'Social',        variant: 'info' },
  MEETING:  { label: 'Reunión',       variant: 'default' },
  TRIP:     { label: 'Viaje',         variant: 'purple' },
}

const defaultForm = {
  title: '',
  description: '',
  type: 'TRAINING' as EventType,
  location: '',
  startAt: '',
  endAt: '',
  maxAttendees: '',
  published: false,
}

export default function AdminEventsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetchEvents = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/events`)
    if (res.ok) {
      const d = await res.json()
      setEvents(d.data ?? d)
    }
    setLoading(false)
  }, [clubId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const openModal = () => {
    setForm(defaultForm)
    setModal(true)
  }

  const submit = async () => {
    if (!form.title || !form.startAt) return toast.error('El título y la fecha de inicio son obligatorios')
    setSubmitting(true)
    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      location: form.location || null,
      startAt: form.startAt,
      endAt: form.endAt || null,
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
      setModal(false)
      fetchEvents()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al crear evento')
    }
    setSubmitting(false)
  }

  const togglePublish = async (event: ClubEvent) => {
    const res = await fetch(`/api/clubs/${clubId}/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !event.published }),
    })
    if (res.ok) {
      toast.success(event.published ? 'Evento ocultado' : 'Evento publicado')
      fetchEvents()
    } else {
      toast.error('Error al actualizar')
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return
    const res = await fetch(`/api/clubs/${clubId}/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Evento eliminado')
      fetchEvents()
    } else {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Eventos" clubId={clubId} />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{events.length} evento(s) en total</p>
          <Button onClick={openModal}>
            <Plus className="h-4 w-4" />
            Nuevo evento
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Cargando...</p>
        ) : events.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-12">No hay eventos. Crea el primero.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => {
              const cfg = EVENT_TYPE_CONFIG[ev.type] ?? { label: ev.type, variant: 'default' as const }
              return (
                <Card key={ev.id} className="flex flex-col">
                  <div className="p-4 flex-1">
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
                    <div className="space-y-1 text-xs text-gray-500">
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
                  </div>
                  <div className="flex items-center gap-1 px-4 pb-4 pt-2 border-t border-gray-100 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePublish(ev)}
                      title={ev.published ? 'Ocultar' : 'Publicar'}
                    >
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
        )}
      </main>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo evento" size="lg">
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
          <Input
            label="Aforo máximo"
            type="number"
            value={form.maxAttendees}
            onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
            placeholder="Sin límite"
          />
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
            <Button className="flex-1" onClick={submit} loading={submitting}>Crear evento</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
