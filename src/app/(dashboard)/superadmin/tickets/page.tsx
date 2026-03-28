'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { fmtRelative, fmtDateTime } from '@/lib/utils'
import {
  Search,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  UserCheck,
  X,
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
  metadata: Record<string, unknown> | null
  creator: { id: string; name: string; email: string; avatarUrl: string | null }
  club: { id: string; name: string; subscription: { plan: string } | null } | null
  assignedTo: { id: string; name: string } | null
  escalatedBy: { id: string; name: string } | null
  messages?: TicketMessage[]
  _count?: { messages: number }
}

interface StatsData {
  totalOpen: number
  urgent: number
  unassigned: number
  resolvedToday: number
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

const PRIORITY_DOT: Record<TicketPriority, string> = {
  LOW: 'bg-gray-400',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
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

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  PREMIUM: 'Premium',
  ENTERPRISE: 'Enterprise',
}

const PLAN_CLASSES: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  PRO: 'bg-blue-100 text-blue-700',
  PREMIUM: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

// SLA thresholds in hours per priority
const SLA_HOURS: Record<TicketPriority, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 4,
}

function getSlaInfo(createdAt: string, priority: TicketPriority) {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000 / 3600
  const sla = SLA_HOURS[priority]
  const pct = elapsed / sla
  if (pct >= 1) return { label: `Vencido (${elapsed.toFixed(0)}h)`, color: 'text-red-600 bg-red-50' }
  if (pct >= 0.75) return { label: `${elapsed.toFixed(0)}h / ${sla}h`, color: 'text-amber-600 bg-amber-50' }
  return { label: `${elapsed.toFixed(0)}h / ${sla}h`, color: 'text-green-600 bg-green-50' }
}

const QUICK_TEMPLATES = [
  'Estamos investigando el problema',
  'Su consulta ha sido resuelta',
  'Por favor, aporte más información',
  'El pago ha sido verificado',
]

const STATUS_OPTIONS: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']
const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const CATEGORY_OPTIONS: TicketCategory[] = ['BILLING', 'TECHNICAL', 'REPORT', 'INQUIRY']

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CLASSES[priority]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

export default function SuperAdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [metaExpanded, setMetaExpanded] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [changingPriority, setChangingPriority] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const PAGE_SIZE = 20

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/tickets?${params}`)
      if (res.ok) {
        const d = await res.json()
        let data: Ticket[] = d.data ?? []
        if (search) {
          const q = search.toLowerCase()
          data = data.filter(
            (t) =>
              t.code.toLowerCase().includes(q) ||
              t.subject.toLowerCase().includes(q)
          )
        }
        setTickets(data)
        setTotal(d.total ?? 0)

        // Compute stats from full data
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        setStats({
          totalOpen: data.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
          urgent: data.filter((t) => t.priority === 'URGENT').length,
          unassigned: data.filter((t) => !t.assignedTo).length,
          resolvedToday: data.filter(
            (t) =>
              (t.status === 'RESOLVED' || t.status === 'CLOSED') &&
              new Date(t.updatedAt) >= todayStart
          ).length,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, categoryFilter, search])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedTicket?.messages])

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setMetaExpanded(false)
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
        toast.success('Respuesta enviada')
        openTicket(selectedTicket)
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al enviar')
      }
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (status: TicketStatus) => {
    if (!selectedTicket) return
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status }),
      })
      if (res.ok) {
        toast.success('Estado actualizado')
        openTicket(selectedTicket)
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error')
      }
    } finally {
      setChangingStatus(false)
    }
  }

  const changePriority = async (priority: TicketPriority) => {
    if (!selectedTicket) return
    setChangingPriority(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_priority', priority }),
      })
      if (res.ok) {
        toast.success('Prioridad actualizada')
        openTicket(selectedTicket)
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error')
      }
    } finally {
      setChangingPriority(false)
    }
  }

  const assignToSelf = async () => {
    if (!selectedTicket) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assignedToId: 'self' }),
      })
      // If 'self' is not a valid id, we need the actual session userId
      // We'll call /api/profile to get the userId first
      if (res.status === 400) {
        const profileRes = await fetch('/api/profile')
        if (profileRes.ok) {
          const profile = await profileRes.json()
          const res2 = await fetch(`/api/tickets/${selectedTicket.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'assign', assignedToId: profile.id }),
          })
          if (res2.ok) {
            toast.success('Ticket asignado')
            openTicket(selectedTicket)
            fetchTickets()
          } else {
            const d = await res2.json()
            toast.error(d.error ?? 'Error al asignar')
          }
        }
      } else if (res.ok) {
        toast.success('Ticket asignado')
        openTicket(selectedTicket)
        fetchTickets()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al asignar')
      }
    } finally {
      setAssigning(false)
    }
  }

  const isHighPriority = (t: Ticket) => t.priority === 'HIGH' || t.priority === 'URGENT'

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Left: Ticket list */}
      <div className="flex flex-col w-full max-w-2xl flex-shrink-0">
        {/* Page header */}
        <h1 className="text-xl font-bold text-gray-900 mb-4">Tickets de soporte</h1>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.totalOpen}</p>
              <p className="text-xs text-gray-500 mt-0.5">Abiertos</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 shadow-sm p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.urgent}</p>
              <p className="text-xs text-red-500 mt-0.5">Urgentes</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 shadow-sm p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.unassigned}</p>
              <p className="text-xs text-amber-500 mt-0.5">Sin asignar</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-green-50 shadow-sm p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{stats.resolvedToday}</p>
              <p className="text-xs text-green-500 mt-0.5">Resueltos hoy</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-4">
          {/* Status tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
            <button
              onClick={() => { setStatusFilter(''); setPage(1) }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todos
            </button>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as TicketCategory | ''); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las categorías</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 min-w-40 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o asunto..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Ticket table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Cargando tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No se encontraron tickets</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Club</th>
                  <th className="px-4 py-3 text-left">Asunto</th>
                  <th className="px-4 py-3 text-left">Cat.</th>
                  <th className="px-4 py-3 text-left">Prior.</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Creador</th>
                  <th className="px-4 py-3 text-left">Asignado</th>
                  <th className="px-4 py-3 text-left">Creado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isHighPriority(ticket) ? 'border-l-4 border-l-red-400' : ''
                    } ${selectedTicket?.id === ticket.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 font-semibold whitespace-nowrap">
                      {ticket.code}
                    </td>
                    <td className="px-4 py-3 max-w-[120px]">
                      {ticket.club ? (
                        <div>
                          <p className="text-xs font-medium text-gray-700 truncate">{ticket.club.name}</p>
                          {ticket.club.subscription && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-0.5 ${
                                PLAN_CLASSES[ticket.club.subscription.plan] ?? 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {PLAN_LABELS[ticket.club.subscription.plan] ?? ticket.club.subscription.plan}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-xs font-medium text-gray-900 truncate">{ticket.subject}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-500">{CATEGORY_LABELS[ticket.category]}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3 max-w-[100px]">
                      <p className="text-xs text-gray-600 truncate">{ticket.creator.name}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[100px]">
                      {ticket.assignedTo ? (
                        <p className="text-xs text-gray-600 truncate">{ticket.assignedTo.name}</p>
                      ) : (
                        <span className="text-xs text-gray-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-400">{fmtRelative(ticket.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Right: Side panel */}
      {selectedTicket ? (
        <div className="flex-1 flex flex-col rounded-2xl shadow-sm border border-gray-100 bg-white overflow-hidden min-w-0">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-500">{selectedTicket.code}</span>
                  <StatusBadge status={selectedTicket.status} />
                  <PriorityBadge priority={selectedTicket.priority} />
                  {selectedTicket.escalatedAt && (
                    <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                      Escalado
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-gray-900 truncate">{selectedTicket.subject}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedTicket.creator.name} · {selectedTicket.creator.email}
                  {selectedTicket.club && ` · ${selectedTicket.club.name}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* SLA indicator */}
            {(selectedTicket.status === 'OPEN' || selectedTicket.status === 'IN_PROGRESS') && (
              <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSlaInfo(selectedTicket.createdAt, selectedTicket.priority).color}`}>
                SLA: {getSlaInfo(selectedTicket.createdAt, selectedTicket.priority).label}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap mt-3">
              <select
                onChange={(e) => changeStatus(e.target.value as TicketStatus)}
                value={selectedTicket.status}
                disabled={changingStatus}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                onChange={(e) => changePriority(e.target.value as TicketPriority)}
                value={selectedTicket.priority}
                disabled={changingPriority}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
              {!selectedTicket.assignedTo && (
                <Button size="sm" variant="outline" onClick={assignToSelf} loading={assigning}>
                  <UserCheck className="h-3.5 w-3.5" />
                  Asignarme
                </Button>
              )}
            </div>
          </div>

          {/* Metadata collapse */}
          {selectedTicket.metadata && (
            <div className="border-b border-gray-100">
              <button
                onClick={() => setMetaExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">Metadatos del dispositivo</span>
                {metaExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {metaExpanded && (
                <div className="px-5 pb-3">
                  <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600">
                    {JSON.stringify(selectedTicket.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                Cargando conversación...
              </div>
            ) : (
              (selectedTicket.messages ?? []).map((msg) => {
                const isAdmin = msg.sender.id !== selectedTicket.creator.id
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.isInternal
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : isAdmin
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.isInternal && (
                        <p className="text-xs font-semibold text-amber-700 mb-1">Nota interna</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p className={`text-xs mt-1 ${isAdmin && !msg.isInternal ? 'text-blue-100' : 'text-gray-400'}`}>
                        {msg.sender.name} · {fmtRelative(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick templates */}
          {selectedTicket.status !== 'CLOSED' && (
            <div className="border-t border-gray-100 px-4 pt-2">
              <div className="flex gap-1.5 flex-wrap pb-2">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    onClick={() => sendReply(t)}
                    disabled={sending}
                    className="px-2.5 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 truncate max-w-[200px]"
                    title={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reply input */}
          {selectedTicket.status !== 'CLOSED' && (
            <div className="px-4 pb-4">
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  rows={2}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 rounded-2xl border border-gray-100 bg-white">
          <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Selecciona un ticket para ver los detalles</p>
        </div>
      )}
    </div>
  )
}
