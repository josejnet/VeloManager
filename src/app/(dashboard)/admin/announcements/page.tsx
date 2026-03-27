'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate, fmtDateTime } from '@/lib/utils'
import {
  Plus, Pin, Paperclip, Trash2, AlertTriangle, Bell,
  CheckCircle2, Users, Calendar, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Priority = 'NORMAL' | 'EMERGENCY'

interface Event {
  id: string
  title: string
  startAt: string
}

interface Announcement {
  id: string
  title: string
  body: string
  imageUrl: string | null
  pinned: boolean
  priority: Priority
  requiresConfirmation: boolean
  targetEventId: string | null
  publishAt: string
  expiresAt: string | null
  sharedFiles: { id: string; name: string; url: string }[]
  _count: { reads: number }
}

const defaultForm = {
  title: '',
  body: '',
  imageUrl: '',
  pinned: false,
  priority: 'NORMAL' as Priority,
  requiresConfirmation: false,
  targetEventId: '' as string | null,
  expiresAt: '',
  files: [] as { name: string; url: string }[],
}

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [newFile, setNewFile] = useState({ name: '', url: '' })
  const [events, setEvents] = useState<Event[]>([])
  const [sending, setSending] = useState(false)
  // Track expanded read-stat panels
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.[0]) {
          const id = d.data[0].id
          setClubId(id)
          // Pre-fetch events for segmentation selector
          fetch(`/api/clubs/${id}/events?pageSize=50`)
            .then((r) => r.json())
            .then((ev) => setEvents(ev.data ?? []))
        }
      })
  }, [session])

  const fetch_ = useCallback(async () => {
    if (!clubId) return
    const res = await fetch(`/api/clubs/${clubId}/announcements?page=${page}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])

  const openModal = () => {
    setForm(defaultForm)
    setNewFile({ name: '', url: '' })
    setModal(true)
  }

  const create = async () => {
    if (!form.title || !form.body) return toast.error('Título y contenido son obligatorios')
    setSending(true)
    const payload: Record<string, any> = {
      title: form.title,
      body: form.body,
      pinned: form.pinned,
      priority: form.priority,
      requiresConfirmation: form.requiresConfirmation,
      targetEventId: form.targetEventId || null,
      ...(form.imageUrl && { imageUrl: form.imageUrl }),
      ...(form.expiresAt && { expiresAt: new Date(form.expiresAt).toISOString() }),
      ...(form.files.length && { files: form.files }),
    }
    try {
      const res = await fetch(`/api/clubs/${clubId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success(
          form.priority === 'EMERGENCY'
            ? '🚨 Comunicado de emergencia enviado'
            : '✅ Anuncio publicado',
          { duration: 4000 }
        )
        setModal(false)
        fetch_()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al publicar')
      }
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este anuncio? Los socios ya no podrán verlo.')) return
    const res = await fetch(`/api/clubs/${clubId}/announcements/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Anuncio eliminado'); fetch_() }
  }

  const addFile = () => {
    if (!newFile.name || !newFile.url) return
    setForm({ ...form, files: [...form.files, { ...newFile }] })
    setNewFile({ name: '', url: '' })
  }

  const targetLabel = (a: Announcement) => {
    if (!a.targetEventId) return 'Todos los socios'
    const ev = events.find((e) => e.id === a.targetEventId)
    return ev ? `Inscritos: ${ev.title}` : 'Evento específico'
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Anuncios y Comunicados" clubId={clubId} />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Tablón de anuncios</CardTitle>
            <Button size="sm" onClick={openModal}>
              <Plus className="h-4 w-4" />Nuevo anuncio
            </Button>
          </CardHeader>

          {!data ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando…</p>
          ) : data.data?.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin anuncios publicados</p>
          ) : (
            <div className="space-y-3">
              {data.data?.map((a: Announcement) => {
                const isEmergency = a.priority === 'EMERGENCY'
                return (
                  <div
                    key={a.id}
                    className={`border rounded-xl p-4 ${
                      isEmergency
                        ? 'border-red-200 bg-red-50'
                        : a.pinned
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Priority icon */}
                      <div className={`mt-0.5 flex-shrink-0 ${isEmergency ? 'text-red-500' : 'text-primary'}`}>
                        {isEmergency ? <AlertTriangle className="h-5 w-5" /> : a.pinned ? <Pin className="h-5 w-5" /> : <Bell className="h-5 w-5 text-gray-300" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{a.title}</p>
                          {isEmergency && <Badge variant="danger">URGENTE</Badge>}
                          {a.requiresConfirmation && (
                            <Badge variant="warning">Requiere confirmación</Badge>
                          )}
                          {a.expiresAt && <Badge variant="warning">Expira {fmtDate(a.expiresAt)}</Badge>}
                        </div>

                        {/* Body */}
                        <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{a.body}</p>

                        {/* Files */}
                        {a.sharedFiles?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {a.sharedFiles.map((f) => (
                              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
                                <Paperclip className="h-3 w-3" />{f.name}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Meta row */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span>{fmtDateTime(a.publishAt)}</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />{targetLabel(a)}
                          </span>
                          {/* Read stats */}
                          <button
                            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            className="flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {a._count.reads} confirmaciones
                            <ChevronDown className={`h-3 w-3 transition-transform ${expandedId === a.id ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Delete */}
                      <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </main>

      {/* ── Create modal ───────────────────────────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo anuncio o comunicado" size="lg">
        <div className="space-y-5">

          {/* Priority selector */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Prioridad del mensaje</p>
            <div className="grid grid-cols-2 gap-3">
              {(['NORMAL', 'EMERGENCY'] as Priority[]).map((p) => {
                const selected = form.priority === p
                const isEmerg = p === 'EMERGENCY'
                return (
                  <button
                    key={p}
                    onClick={() => setForm({ ...form, priority: p })}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      selected
                        ? isEmerg
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {isEmerg
                      ? <AlertTriangle className={`h-4 w-4 ${selected ? 'text-red-500' : 'text-gray-300'}`} />
                      : <Bell className={`h-4 w-4 ${selected ? 'text-primary' : 'text-gray-300'}`} />
                    }
                    {isEmerg ? 'Emergencia' : 'Normal'}
                  </button>
                )
              })}
            </div>
            {form.priority === 'EMERGENCY' && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Se mostrará como modal bloqueante. El socio debe confirmar explícitamente.
              </p>
            )}
          </div>

          {/* Title + body */}
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          {/* Segmentation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-4 w-4 mr-1 text-gray-400" />
              Destinatarios
            </label>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={form.targetEventId ?? ''}
              onChange={(e) => setForm({ ...form, targetEventId: e.target.value || null })}
            >
              <option value="">Todos los socios del club</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  Inscritos en: {ev.title} ({fmtDate(ev.startAt)})
                </option>
              ))}
            </select>
            {form.targetEventId && (
              <p className="text-xs text-gray-500 mt-1">
                Solo recibirán el anuncio los socios inscritos (estado GOING) en ese evento.
              </p>
            )}
          </div>

          {/* Options row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="URL imagen (opcional)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />
            <Input
              label="Expira el (opcional)"
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              <Pin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">Fijar en la parte superior</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.requiresConfirmation}
                onChange={(e) => setForm({ ...form, requiresConfirmation: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">Requerir confirmación de lectura</span>
            </label>
          </div>

          {/* Attached files */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Archivos adjuntos</p>
            {form.files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 mb-1">
                <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium truncate">{f.name}</span>
                <button
                  className="ml-auto text-red-400 hover:text-red-600"
                  onClick={() => setForm({ ...form, files: form.files.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-1">
              <input
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                placeholder="Nombre del archivo"
                value={newFile.name}
                onChange={(e) => setNewFile({ ...newFile, name: e.target.value })}
              />
              <input
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                placeholder="URL del archivo"
                value={newFile.url}
                onChange={(e) => setNewFile({ ...newFile, url: e.target.value })}
              />
              <Button size="sm" variant="outline" onClick={addFile}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              className={`flex-1 ${form.priority === 'EMERGENCY' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              onClick={create}
              loading={sending}
            >
              {form.priority === 'EMERGENCY' ? '🚨 Publicar comunicado urgente' : 'Publicar anuncio'}
            </Button>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
