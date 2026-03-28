'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '@/providers/DashboardProvider'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { fmtRelative } from '@/lib/utils'
import {
  Plus,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Send,
  ArrowUpCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED'
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type TicketCategory = 'BILLING' | 'TECHNICAL' | 'REPORT' | 'INQUIRY'

interface TicketMessage {
  id: string
  body: string
  isInternal: boolean
  attachments: string[]
  createdAt: string
  sender: { id: string; name: string; avatarUrl: string | null }
}

interface Ticket {
  id: string
  code: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  escalatedAt: string | null
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string; email: string; avatarUrl: string | null }
  club: { id: string; name: string; subscription: { plan: string } | null } | null
  assignedTo: { id: string; name: string } | null
  messages?: TicketMessage[]
  _count?: { messages: number }
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  WAITING: 'Esperando',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
}

const STATUS_CLASSES: Record<TicketStatus, string> = {
  OPEN: 'bg-green-100 text-green-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  WAITING: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-gray-100 text-gray-600',
  CLOSED: 'bg-gray-200 text-gray-600',
}

const PRIORITY_CLASSES: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BILLING: 'Facturación',
  TECHNICAL: 'Técnico',
  REPORT: 'Denuncia',
  INQUIRY: 'Consulta',
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CLASSES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

export default function AdminSupportPage() {
  const { clubId } = useDashboard()
  const [tab, setTab] = useState<'incoming' | 'sent'>('incoming')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'INQUIRY' as TicketCategory,
  })
  const [submitting, setSubmitting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const PAGE_SIZE = 20

  const fetchTickets = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    try {
      const url =
        tab === 'incoming'
          ? `/api/tickets?page=${page}&pageSize=${PAGE_SIZE}`
          : `/api/tickets?page=${page}&pageSize=${PAGE_SIZE}`
      const res = await fetch(url, {
        headers: { 'x-active-club-id': clubId },
      })
      if (res.ok) {
        const d = await res.json()
        // For 'incoming': club tickets from members; 'sent': tickets created by admin (no clubId)
        const filtered =
          tab === 'incoming'
            ? (d.data ?? []).filter((t: Ticket) => t.club?.id === clubId)
            : (d.data ?? []).filter((t: Ticket) => !t.club || t.club.id !== clubId)
        setTickets(filtered)
        setTotal(d.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [clubId, tab, page])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedTicket?.messages])

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`)
      if (res.ok) {
        const d = await res.json()
        setSelectedTicket(d)
      }
    } finally {
      setThreadLoading(false)
    }
  }

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      })
      if (res.ok) {
        setReply('')
        toast.success('Respuesta enviada')
        openTicket(selectedTicket)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al enviar')
      }
    } finally {
      setSending(false)
    }
  }

  const escalate = async () => {
    if (!selectedTicket) return
    setEscalating(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/escalate`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success('Ticket escalado a soporte global')
        openTicket(selectedTicket)
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al escalar')
      }
    } finally {
      setEscalating(false)
    }
  }

  const createTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      if (res.ok) {
        toast.success('Ticket creado')
        setCreateModal(false)
        setForm({ subject: '', description: '', category: 'INQUIRY' })
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al crear ticket')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Left panel */}
      <div className="flex flex-col w-full max-w-lg flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Soporte</h1>
          <Button size="sm" onClick={() => setCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setTab('incoming'); setPage(1) }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'incoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Mis tickets
          </button>
          <button
            onClick={() => { setTab('sent'); setPage(1) }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'sent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tickets a soporte
          </button>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Cargando tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No hay tickets</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className={`w-full text-left rounded-2xl shadow-sm border bg-white p-4 hover:border-blue-200 transition-colors ${
                  selectedTicket?.id === ticket.id
                    ? 'border-blue-400 ring-1 ring-blue-400'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-semibold text-gray-500">
                        {ticket.code}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600`}>
                        {CATEGORY_LABELS[ticket.category]}
                      </span>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ticket.creator.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">{fmtRelative(ticket.createdAt)}</span>
                    {(ticket._count?.messages ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-400">
                        <MessageSquare className="h-3 w-3" />
                        {ticket._count?.messages}
                      </span>
                    )}
                    {ticket.escalatedAt && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        Escalado
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <Pagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Right panel — Thread */}
      {selectedTicket ? (
        <div className="flex-1 flex flex-col rounded-2xl shadow-sm border border-gray-100 bg-white overflow-hidden">
          {/* Thread header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-500">
                    {selectedTicket.code}
                  </span>
                  <StatusBadge status={selectedTicket.status} />
                  <PriorityBadge priority={selectedTicket.priority} />
                  {selectedTicket.escalatedAt && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-3 w-3" />
                      Escalado
                    </span>
                  )}
                </div>
                <h2 className="text-base font-semibold text-gray-900">{selectedTicket.subject}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedTicket.creator.name} · {fmtRelative(selectedTicket.createdAt)}
                  {selectedTicket.club && ` · ${selectedTicket.club.name}`}
                </p>
              </div>
              {!selectedTicket.escalatedAt && tab === 'incoming' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={escalate}
                  loading={escalating}
                  className="flex-shrink-0"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Escalar a Soporte Global
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                Cargando conversación...
              </div>
            ) : (
              (selectedTicket.messages ?? []).map((msg) => {
                const isMe = msg.sender.id !== selectedTicket.creator.id
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.isInternal
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : isMe
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.isInternal && (
                        <p className="text-xs font-semibold text-amber-700 mb-1">Nota interna</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isMe && !msg.isInternal ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {msg.sender.name} · {fmtRelative(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED' && (
            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  rows={2}
                  className="flex-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply()
                  }}
                />
                <Button
                  onClick={sendReply}
                  loading={sending}
                  disabled={!reply.trim()}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Ctrl+Enter para enviar</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 rounded-2xl border border-gray-100 bg-white">
          <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Selecciona un ticket para ver la conversación</p>
        </div>
      )}

      {/* Create ticket modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Nuevo ticket a soporte"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Asunto"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Describe brevemente el problema"
          />
          <Select
            label="Categoría"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TicketCategory }))}
            options={[
              { value: 'BILLING', label: 'Facturación' },
              { value: 'TECHNICAL', label: 'Técnico' },
              { value: 'REPORT', label: 'Denuncia' },
              { value: 'INQUIRY', label: 'Consulta' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Explica el problema en detalle..."
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={createTicket}
              loading={submitting}
              disabled={!form.subject.trim() || !form.description.trim()}
            >
              Crear ticket
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
