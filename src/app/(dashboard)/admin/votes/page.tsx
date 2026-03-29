'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate } from '@/lib/utils'
import { Plus, Square, BarChart2, Clock, Calendar } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import toast from 'react-hot-toast'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

const STATUS_CONFIG = {
  scheduled: { label: 'Programada', variant: 'warning' as const, icon: Clock },
  active:    { label: 'Activa',     variant: 'success' as const, icon: null },
  closed:    { label: 'Cerrada',    variant: 'default' as const, icon: null },
}

// Returns the computed status for frontend rendering (mirrors backend voteStatus())
function computeStatus(vote: { active: boolean; startsAt: string | null; endsAt: string | null }): 'scheduled' | 'active' | 'closed' {
  if (!vote.active) return 'closed'
  const now = new Date()
  if (vote.startsAt && new Date(vote.startsAt) > now) return 'scheduled'
  if (vote.endsAt && new Date(vote.endsAt) <= now) return 'closed'
  return 'active'
}

export default function VotesPage() {
  const { clubId } = useClub()
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [resultModal, setResultModal] = useState<any>(null)
  const [confirmClose, setConfirmClose] = useState<{ open: boolean; voteId: string; title: string }>({ open: false, voteId: '', title: '' })
  const [closingId, setClosingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', options: ['', ''],
    startsAt: '', endsAt: '',
  })

  const { data, mutate } = useSWR<any>(
    clubId ? `/api/clubs/${clubId}/votes?active=false&page=${page}` : null,
    { keepPreviousData: true }
  )

  const create = async () => {
    const validOptions = form.options.filter((o) => o.trim())
    if (validOptions.length < 2) return toast.error('Mínimo 2 opciones')
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      return toast.error('La fecha de cierre debe ser posterior a la de inicio')
    }
    const payload: Record<string, unknown> = { title: form.title, description: form.description, options: validOptions }
    if (form.startsAt) payload.startsAt = new Date(form.startsAt).toISOString()
    if (form.endsAt) payload.endsAt = new Date(form.endsAt).toISOString()

    const res = await fetch(`/api/clubs/${clubId}/votes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Votación creada')
      setModal(false)
      setForm({ title: '', description: '', options: ['', ''], startsAt: '', endsAt: '' })
      mutate()
    } else {
      const d = await res.json(); toast.error(d.error ?? 'Error')
    }
  }

  const closeVote = async (voteId: string) => {
    setClosingId(voteId)
    const res = await fetch(`/api/clubs/${clubId}/votes/${voteId}`, { method: 'PATCH' })
    setClosingId(null)
    if (res.ok) { toast.success('Votación cerrada'); setConfirmClose({ open: false, voteId: '', title: '' }); mutate() }
    else toast.error('Error al cerrar')
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Votaciones y Encuestas" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Votaciones</CardTitle>
            <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nueva votación</Button>
          </CardHeader>

          {!data ? <p className="text-sm text-gray-400 py-8 text-center animate-pulse">Cargando…</p> : (
            <div className="space-y-3">
              {data.data?.length === 0 && (
                <p className="text-sm text-gray-400 py-8 text-center">Sin votaciones. Crea la primera.</p>
              )}
              {data.data?.map((vote: any) => {
                const totalVotes = vote._count?.responses ?? 0
                const status = computeStatus(vote)
                const cfg = STATUS_CONFIG[status]
                return (
                  <div key={vote.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{vote.title}</p>
                          <Badge variant={cfg.variant} className="flex items-center gap-1">
                            {cfg.icon && <cfg.icon className="h-3 w-3" />}
                            {cfg.label}
                          </Badge>
                        </div>
                        {vote.description && <p className="text-sm text-gray-500 mt-0.5">{vote.description}</p>}
                        <p className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3">
                          <span>{totalVotes} votos · {vote.options?.length} opciones</span>
                          {vote.startsAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Inicia {fmtDate(vote.startsAt)}
                            </span>
                          )}
                          {vote.endsAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Cierra {fmtDate(vote.endsAt)}
                            </span>
                          )}
                          {!vote.startsAt && !vote.endsAt && <span>Creada {fmtDate(vote.createdAt)}</span>}
                        </p>

                        {/* Mini bar chart */}
                        <div className="mt-3 space-y-1.5">
                          {vote.options?.map((opt: any, i: number) => {
                            const count = opt._count?.responses ?? 0
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                            return (
                              <div key={opt.id} className="flex items-center gap-2 text-xs">
                                <span className="w-36 truncate text-gray-600">{opt.text}</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-12 text-right font-medium text-gray-700">{count} ({pct}%)</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setResultModal(vote)}>
                          <BarChart2 className="h-3 w-3" /> Gráfico
                        </Button>
                        {status !== 'closed' && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={closingId === vote.id}
                            onClick={() => setConfirmClose({ open: true, voteId: vote.id, title: vote.title })}
                          >
                            <Square className="h-3 w-3" /> {closingId === vote.id ? 'Cerrando...' : 'Cerrar'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
            </div>
          )}
        </Card>
      </main>

      {/* Create vote modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva votación" size="md">
        <div className="space-y-4">
          <Input label="Pregunta" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Descripción (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inicio <span className="text-gray-400 font-normal">(vacío = ahora)</span>
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cierre <span className="text-gray-400 font-normal">(vacío = manual)</span>
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Opciones de respuesta</p>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder={`Opción ${i + 1}`} value={opt}
                    onChange={(e) => { const opts = [...form.options]; opts[i] = e.target.value; setForm({ ...form, options: opts }) }} />
                  {form.options.length > 2 && (
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}>✕</Button>
                  )}
                </div>
              ))}
              {form.options.length < 10 && (
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, ''] })}>
                  <Plus className="h-3 w-3" /> Añadir opción
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear votación</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm close vote modal */}
      <Modal open={confirmClose.open} onClose={() => setConfirmClose({ open: false, voteId: '', title: '' })} title="Cerrar votación" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Seguro que quieres cerrar la votación <span className="font-semibold">"{confirmClose.title}"</span>?
            Esta acción es irreversible y los socios no podrán votar más.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" variant="danger" disabled={closingId === confirmClose.voteId} onClick={() => closeVote(confirmClose.voteId)}>
              {closingId === confirmClose.voteId ? 'Cerrando...' : 'Sí, cerrar'}
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => setConfirmClose({ open: false, voteId: '', title: '' })}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results chart modal */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title={resultModal?.title ?? ''} size="lg">
        {resultModal && (
          <div>
            <p className="text-sm text-gray-500 mb-4">{resultModal._count?.responses ?? 0} votos totales</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={resultModal.options?.map((o: any) => ({ name: o.text, votos: o._count?.responses ?? 0 }))}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="votos" radius={[6, 6, 0, 0]}>
                  {resultModal.options?.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Modal>
    </div>
  )
}
