'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '@/providers/DashboardProvider'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtRelative } from '@/lib/utils'
import { Plus, MessageSquare, Send, ArrowLeft, ChevronRight } from 'lucide-react'
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
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string; email: string; avatarUrl: string | null }
  club: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  messages?: TicketMessage[]
  _count?: { messages: number }
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  WAITING: 'Esperando respuesta',
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

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BILLING: 'Facturación',
  TECHNICAL: 'Problema técnico',
  REPORT: 'Denuncia',
  INQUIRY: 'Consulta',
}

const CATEGORY_ICONS: Record<TicketCategory, string> = {
  BILLING: '💳',
  TECHNICAL: '🔧',
  REPORT: '🚨',
  INQUIRY: '💬',
}

const QUICK_REPLIES = [
  '¿Hay alguna actualización?',
  'El problema persiste',
  'Ya está resuelto, gracias',
]

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export default function SocioSupportPage() {
  const { clubId } = useDashboard()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null)
  const [form, setForm] = useState({ subject: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<'category' | 'details'>('category')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const PAGE_SIZE = 20

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: clubId ? { 'x-active-club-id': clubId } : {},
      })
      if (res.ok) {
        const d = await res.json()
        setTickets(d.data ?? [])
        setTotal(d.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [clubId, page])

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

  const sendReply = async (text?: string) => {
    const body = text ?? reply
    if (!selectedTicket || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        setReply('')
        toast.success('Mensaje enviado')
        openTicket(selectedTicket)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al enviar')
      }
    } finally {
      setSending(false)
    }
  }

  const createTicket = async () => {
    if (!selectedCategory || !form.subject.trim() || !form.description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          description: form.description,
          category: selectedCategory,
          clubId: clubId || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Ticket creado')
        setCreateModal(false)
        setForm({ subject: '', description: '' })
        setSelectedCategory(null)
        setStep('category')
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al crear ticket')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resetModal = () => {
    setCreateModal(false)
    setSelectedCategory(null)
    setStep('category')
    setForm({ subject: '', description: '' })
  }

  // Chat view on mobile / detail view
  if (selectedTicket) {
    const messages = (selectedTicket.messages ?? []).filter((m) => !m.isInternal)
    const canReply =
      selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED'

    return (
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTicket(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-mono text-xs font-semibold text-gray-500">
                  {selectedTicket.code}
                </span>
                <StatusBadge status={selectedTicket.status} />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 truncate">{selectedTicket.subject}</h2>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {threadLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Cargando conversación...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No hay mensajes aún</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender.id === selectedTicket.creator.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isMe ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                      {isMe ? 'Tú' : msg.sender.name} · {fmtRelative(msg.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies + input */}
        {canReply && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr}
                  onClick={() => sendReply(qr)}
                  disabled={sending}
                  className="px-3 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                >
                  {qr}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={2}
                className="flex-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply()
                }}
              />
              <Button
                onClick={() => sendReply()}
                loading={sending}
                disabled={!reply.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">¿En qué podemos ayudarte?</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Crea un ticket y nuestro equipo te responderá lo antes posible.
        </p>
      </div>

      {/* New ticket button */}
      <button
        onClick={() => setCreateModal(true)}
        className="w-full rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors p-5 flex items-center gap-3 mb-6"
      >
        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Plus className="h-5 w-5 text-white" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-blue-700">Nuevo ticket</p>
          <p className="text-xs text-blue-500">Describe tu consulta o problema</p>
        </div>
      </button>

      {/* Ticket list */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Mis tickets</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
          Cargando...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 flex flex-col items-center text-gray-400">
          <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No tienes tickets aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const lastMessage = ticket.messages?.[ticket.messages.length - 1]
            return (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="w-full text-left rounded-2xl shadow-sm border border-gray-100 bg-white p-4 hover:border-blue-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-semibold text-gray-400">
                        {ticket.code}
                      </span>
                      <span className="text-xs text-gray-500">
                        {CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}
                      </span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                    {lastMessage && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {lastMessage.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">{fmtRelative(ticket.createdAt)}</span>
                    {(ticket._count?.messages ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-400">
                        <MessageSquare className="h-3 w-3" />
                        {ticket._count?.messages}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Create ticket modal */}
      <Modal
        open={createModal}
        onClose={resetModal}
        title="Nuevo ticket de soporte"
        size="md"
      >
        {step === 'category' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Selecciona la categoría que mejor describe tu consulta:</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat)
                    setStep('details')
                  }}
                  className={`rounded-xl border-2 p-4 text-left transition-colors hover:border-blue-400 ${
                    selectedCategory === cat
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-2xl block mb-2">{CATEGORY_ICONS[cat]}</span>
                  <span className="text-sm font-medium text-gray-900">{CATEGORY_LABELS[cat]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setStep('category')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Cambiar categoría
            </button>
            {selectedCategory && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <span>{CATEGORY_ICONS[selectedCategory]}</span>
                <span className="text-sm font-medium text-blue-700">
                  {CATEGORY_LABELS[selectedCategory]}
                </span>
              </div>
            )}
            <Input
              label="Asunto"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Describe brevemente el problema"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Explica el problema con detalle. Cuanta más información des, más rápido podremos ayudarte."
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetModal}>
                Cancelar
              </Button>
              <Button
                onClick={createTicket}
                loading={submitting}
                disabled={!form.subject.trim() || !form.description.trim()}
              >
                Enviar ticket
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

