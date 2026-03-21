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
import { fmtDate } from '@/lib/utils'
import { Plus, Square, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import toast from 'react-hot-toast'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export default function VotesPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [resultModal, setResultModal] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', options: ['', ''] })

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetch_ = useCallback(async () => {
    if (!clubId) return
    const res = await fetch(`/api/clubs/${clubId}/votes?active=false&page=${page}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])

  const create = async () => {
    const validOptions = form.options.filter((o) => o.trim())
    if (validOptions.length < 2) return toast.error('Mínimo 2 opciones')
    const res = await fetch(`/api/clubs/${clubId}/votes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, options: validOptions }),
    })
    if (res.ok) { toast.success('Votación creada'); setModal(false); setForm({ title: '', description: '', options: ['', ''] }); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const closeVote = async (voteId: string) => {
    const res = await fetch(`/api/clubs/${clubId}/votes/${voteId}`, { method: 'PATCH' })
    if (res.ok) { toast.success('Votación cerrada'); fetch_() }
    else toast.error('Error al cerrar')
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Votaciones y Encuestas" clubId={clubId} />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Votaciones</CardTitle>
            <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nueva votación</Button>
          </CardHeader>

          {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
            <div className="space-y-3">
              {data.data?.map((vote: any) => {
                const totalVotes = vote._count?.responses ?? 0
                return (
                  <div key={vote.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{vote.title}</p>
                          <Badge variant={vote.active ? 'success' : 'default'}>
                            {vote.active ? 'Activa' : 'Cerrada'}
                          </Badge>
                        </div>
                        {vote.description && <p className="text-sm text-gray-500 mt-0.5">{vote.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {totalVotes} votos · {vote.options?.length} opciones · Creada {fmtDate(vote.createdAt)}
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
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline" onClick={() => setResultModal(vote)}>
                          <BarChart2 className="h-3 w-3" /> Gráfico
                        </Button>
                        {vote.active && (
                          <Button size="sm" variant="danger" onClick={() => closeVote(vote.id)}>
                            <Square className="h-3 w-3" /> Cerrar
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
