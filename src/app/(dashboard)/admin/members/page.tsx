'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, MemberStatusBadge, QuotaStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate, fmtCurrency } from '@/lib/utils'
import { Check, X, Plus, User, Mail, Link2, Copy, Send, Trash2, Ban, ShieldCheck, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MemberWithUser, PaginatedResponse } from '@/types'

type TabType = 'APPROVED' | 'PENDING' | 'SUSPENDED' | 'BANNED' | 'invitations' | 'import'

type Invitation = {
  id: string
  channel: 'EMAIL' | 'LINK' | 'CODE'
  invitedEmail: string | null
  assignedRole: string
  status: string
  usesCount: number
  maxUses: number | null
  expiresAt: string | null
  token: string
  note: string | null
  createdAt: string
  invitedBy: { name: string }
}

type ConfirmAction = {
  open: boolean
  memberId: string
  memberName: string
  action: 'reject' | 'suspend' | 'ban'
}

export default function MembersPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState<string>('')
  const [tab, setTab] = useState<TabType>('APPROVED')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<MemberWithUser> | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Quotas
  const [quotaModal, setQuotaModal] = useState<{ open: boolean; membershipId: string; memberName: string }>({ open: false, membershipId: '', memberName: '' })
  const [quotaForm, setQuotaForm] = useState({ year: new Date().getFullYear(), amount: '' })

  // Confirm destructive modal
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [actionReason, setActionReason] = useState('')

  // Role change modal
  const [roleModal, setRoleModal] = useState<{ open: boolean; memberId: string; memberName: string; currentRole: string } | null>(null)
  const [newRole, setNewRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')

  // Invitations
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [invFilter, setInvFilter] = useState<string>('PENDING')
  const [newInvModal, setNewInvModal] = useState(false)
  const [invChannel, setInvChannel] = useState<'EMAIL' | 'LINK' | 'CODE'>('EMAIL')
  const [invForm, setInvForm] = useState({
    invitedEmail: '',
    assignedRole: 'MEMBER',
    expiresInDays: 7,
    maxUses: 1,
    note: '',
  })
  const [invSending, setInvSending] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  // Pending counts
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetchMembers = useCallback(async () => {
    if (!clubId || tab === 'invitations') return
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/members?status=${tab}&page=${page}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [clubId, tab, page])

  const fetchPendingCount = useCallback(async () => {
    if (!clubId) return
    const res = await fetch(`/api/clubs/${clubId}/members?status=PENDING&pageSize=1`)
    if (res.ok) { const d = await res.json(); setPendingCount(d.total ?? 0) }
  }, [clubId])

  const fetchInvitations = useCallback(async () => {
    if (!clubId) return
    setInvLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/invitations?status=${invFilter}`)
    if (res.ok) { const d = await res.json(); setInvitations(d.data ?? []) }
    setInvLoading(false)
  }, [clubId, invFilter])

  useEffect(() => { fetchMembers() }, [fetchMembers])
  useEffect(() => { fetchPendingCount() }, [fetchPendingCount])
  useEffect(() => { if (tab === 'invitations') fetchInvitations() }, [tab, fetchInvitations])

  const doMemberAction = async (memberId: string, action: string, extra?: Record<string, unknown>) => {
    setUpdatingId(memberId)
    const res = await fetch(`/api/clubs/${clubId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    setUpdatingId(null)
    if (res.ok) {
      toast.success('Acción realizada')
      setConfirmAction(null)
      setActionReason('')
      setRoleModal(null)
      fetchMembers()
      fetchPendingCount()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al procesar la acción')
    }
  }

  const assignQuota = async () => {
    if (!quotaForm.amount) return toast.error('Introduce un importe')
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId: quotaModal.membershipId, year: quotaForm.year, amount: parseFloat(quotaForm.amount) }),
    })
    if (res.ok) { toast.success('Cuota asignada'); setQuotaModal({ ...quotaModal, open: false }); fetchMembers() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const createInvitation = async () => {
    setInvSending(true)
    setGeneratedLink(null)
    const body: Record<string, unknown> = {
      channel: invChannel,
      assignedRole: invForm.assignedRole,
      note: invForm.note || undefined,
    }
    if (invChannel === 'EMAIL') {
      body.invitedEmail = invForm.invitedEmail
      body.expiresInDays = invForm.expiresInDays
    } else {
      body.expiresInDays = invForm.expiresInDays || null
      body.maxUses = invForm.maxUses || null
    }

    const res = await fetch(`/api/clubs/${clubId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setInvSending(false)
    if (res.ok) {
      const inv = await res.json()
      if (invChannel === 'EMAIL') {
        toast.success('Invitación enviada por email')
        setNewInvModal(false)
      } else {
        const link = `${window.location.origin}/invite/${inv.token}`
        setGeneratedLink(link)
      }
      fetchInvitations()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al crear invitación')
    }
  }

  const revokeInvitation = async (invId: string) => {
    const res = await fetch(`/api/clubs/${clubId}/invitations/${invId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Invitación revocada'); fetchInvitations() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const resendInvitation = async (invId: string) => {
    const res = await fetch(`/api/clubs/${clubId}/invitations/${invId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resend' }),
    })
    if (res.ok) toast.success('Invitación reenviada')
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
    toast.success('Enlace copiado')
  }

  const channelIcon = (ch: string) => ch === 'EMAIL' ? '📧' : ch === 'LINK' ? '🔗' : '🔑'
  const channelLabel = (ch: string) => ch === 'EMAIL' ? 'Email' : ch === 'LINK' ? 'Enlace' : 'Código'

  const invStatusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    ACCEPTED: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-gray-100 text-gray-500',
    REVOKED: 'bg-red-100 text-red-600',
    REJECTED: 'bg-orange-100 text-orange-600',
  }

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: 'APPROVED', label: 'Activos' },
    { key: 'PENDING', label: 'Solicitudes', badge: pendingCount },
    { key: 'SUSPENDED', label: 'Suspendidos' },
    { key: 'BANNED', label: 'Baneados' },
    { key: 'invitations', label: 'Invitaciones' },
    { key: 'import', label: 'Importar' },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Gestión de Socios" clubId={clubId} />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Socios</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {tabs.map(({ key, label, badge }) => (
                <button
                  key={key}
                  onClick={() => { setTab(key); setPage(1) }}
                  className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors ${tab === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {label}
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardHeader>

          {/* ── Members table (APPROVED / PENDING / SUSPENDED / BANNED) ── */}
          {tab !== 'invitations' && tab !== 'import' && (
            loading ? (
              <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
            ) : !data?.data.length ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sin resultados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left py-2.5 font-medium">Socio</th>
                      <th className="text-left py-2.5 font-medium">Estado</th>
                      <th className="text-left py-2.5 font-medium">Desde</th>
                      {tab === 'APPROVED' && <th className="text-left py-2.5 font-medium">Cuotas</th>}
                      {tab === 'BANNED' && <th className="text-left py-2.5 font-medium">Motivo</th>}
                      <th className="text-right py-2.5 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.data.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{m.user.name}</p>
                              <p className="text-xs text-gray-400">{m.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3"><MemberStatusBadge status={m.status} /></td>
                        <td className="py-3 text-gray-500">{m.joinedAt ? fmtDate(m.joinedAt) : '—'}</td>
                        {tab === 'APPROVED' && (
                          <td className="py-3">
                            {m.quotas.length === 0
                              ? <span className="text-gray-400">Sin cuotas</span>
                              : m.quotas.slice(0, 2).map((q) => <QuotaStatusBadge key={q.id} status={q.status} />)}
                          </td>
                        )}
                        {tab === 'BANNED' && (
                          <td className="py-3 text-xs text-gray-500 max-w-xs truncate">
                            {(m as any).bannedReason ?? '—'}
                          </td>
                        )}
                        <td className="py-3">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {tab === 'PENDING' && (
                              <>
                                <Button size="sm" variant="primary" disabled={updatingId === m.id} onClick={() => doMemberAction(m.id, 'approve')}>
                                  <Check className="h-3 w-3" /> {updatingId === m.id ? '...' : 'Aprobar'}
                                </Button>
                                <Button size="sm" variant="danger" disabled={updatingId === m.id} onClick={() => { setConfirmAction({ open: true, memberId: m.id, memberName: m.user.name, action: 'reject' }); setActionReason('') }}>
                                  <X className="h-3 w-3" /> Rechazar
                                </Button>
                              </>
                            )}
                            {tab === 'APPROVED' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setQuotaModal({ open: true, membershipId: m.id, memberName: m.user.name })}>
                                  <Plus className="h-3 w-3" /> Cuota
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setRoleModal({ open: true, memberId: m.id, memberName: m.user.name, currentRole: m.clubRole }); setNewRole(m.clubRole === 'ADMIN' ? 'MEMBER' : 'ADMIN') }}>
                                  Rol
                                </Button>
                                <Button size="sm" variant="ghost" disabled={updatingId === m.id} onClick={() => { setConfirmAction({ open: true, memberId: m.id, memberName: m.user.name, action: 'suspend' }); setActionReason('') }}>
                                  Suspender
                                </Button>
                                <Button size="sm" variant="danger" disabled={updatingId === m.id} onClick={() => { setConfirmAction({ open: true, memberId: m.id, memberName: m.user.name, action: 'ban' }); setActionReason('') }}>
                                  <Ban className="h-3 w-3" /> Banear
                                </Button>
                              </>
                            )}
                            {tab === 'SUSPENDED' && (
                              <>
                                <Button size="sm" variant="primary" disabled={updatingId === m.id} onClick={() => doMemberAction(m.id, 'unsuspend')}>
                                  {updatingId === m.id ? '...' : 'Reactivar'}
                                </Button>
                                <Button size="sm" variant="danger" disabled={updatingId === m.id} onClick={() => { setConfirmAction({ open: true, memberId: m.id, memberName: m.user.name, action: 'ban' }); setActionReason('') }}>
                                  <Ban className="h-3 w-3" /> Banear
                                </Button>
                              </>
                            )}
                            {tab === 'BANNED' && (
                              <Button size="sm" variant="outline" disabled={updatingId === m.id} onClick={() => doMemberAction(m.id, 'unban')}>
                                <ShieldCheck className="h-3 w-3" /> {updatingId === m.id ? '...' : 'Desbanear'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
              </div>
            )
          )}

          {/* ── Import tab ── */}
          {tab === 'import' && (
            <ImportTab clubId={clubId} />
          )}

          {/* ── Invitations tab ── */}
          {tab === 'invitations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex gap-2">
                  {['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'].map((s) => (
                    <button key={s} onClick={() => setInvFilter(s)} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${invFilter === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s === 'PENDING' ? 'Pendientes' : s === 'ACCEPTED' ? 'Aceptadas' : s === 'EXPIRED' ? 'Expiradas' : 'Revocadas'}
                    </button>
                  ))}
                </div>
                <Button size="sm" onClick={() => { setNewInvModal(true); setGeneratedLink(null); setInvChannel('EMAIL'); setInvForm({ invitedEmail: '', assignedRole: 'MEMBER', expiresInDays: 7, maxUses: 1, note: '' }) }}>
                  <Plus className="h-3 w-3" /> Nueva invitación
                </Button>
              </div>

              {invLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
              ) : !invitations.length ? (
                <p className="text-sm text-gray-400 py-8 text-center">Sin invitaciones</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="text-left py-2.5 font-medium">Canal</th>
                        <th className="text-left py-2.5 font-medium">Destino</th>
                        <th className="text-left py-2.5 font-medium">Rol</th>
                        <th className="text-left py-2.5 font-medium">Usos</th>
                        <th className="text-left py-2.5 font-medium">Expira</th>
                        <th className="text-left py-2.5 font-medium">Estado</th>
                        <th className="text-right py-2.5 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {invitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="py-3 text-base">{channelIcon(inv.channel)} <span className="text-xs text-gray-500 ml-1">{channelLabel(inv.channel)}</span></td>
                          <td className="py-3">
                            {inv.invitedEmail
                              ? <span className="text-sm text-gray-700">{inv.invitedEmail}</span>
                              : <span className="text-xs text-gray-400 italic">Enlace público</span>}
                            {inv.note && <p className="text-xs text-gray-400 truncate max-w-[150px]">{inv.note}</p>}
                          </td>
                          <td className="py-3 text-xs text-gray-500">{inv.assignedRole === 'ADMIN' ? 'Admin' : 'Socio'}</td>
                          <td className="py-3 text-xs text-gray-500">{inv.usesCount}/{inv.maxUses ?? '∞'}</td>
                          <td className="py-3 text-xs text-gray-500">
                            {inv.expiresAt ? fmtDate(inv.expiresAt) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${invStatusColor[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {inv.status === 'PENDING' ? 'Pendiente' : inv.status === 'ACCEPTED' ? 'Aceptada' : inv.status === 'EXPIRED' ? 'Expirada' : inv.status === 'REVOKED' ? 'Revocada' : inv.status}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex justify-end gap-1">
                              {inv.status === 'PENDING' && (
                                <>
                                  {inv.channel !== 'EMAIL' && (
                                    <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {inv.channel === 'EMAIL' && (
                                    <Button size="sm" variant="outline" onClick={() => resendInvitation(inv.id)}>
                                      <Send className="h-3 w-3" /> Reenviar
                                    </Button>
                                  )}
                                  <Button size="sm" variant="danger" onClick={() => revokeInvitation(inv.id)}>
                                    <Trash2 className="h-3 w-3" /> Revocar
                                  </Button>
                                </>
                              )}
                              {inv.status === 'ACCEPTED' && inv.channel !== 'EMAIL' && (
                                <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                                  <Copy className="h-3 w-3" /> Copiar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>

      {/* ── Confirm action modal (reject / suspend / ban) ── */}
      {confirmAction && (
        <Modal open={confirmAction.open} onClose={() => setConfirmAction(null)}
          title={confirmAction.action === 'reject' ? 'Rechazar solicitud' : confirmAction.action === 'suspend' ? 'Suspender socio' : 'Banear socio'}
          size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmAction.action === 'reject' && <>¿Rechazar la solicitud de <strong>{confirmAction.memberName}</strong>?</>}
              {confirmAction.action === 'suspend' && <>¿Suspender a <strong>{confirmAction.memberName}</strong>? No podrá acceder hasta que sea reactivado.</>}
              {confirmAction.action === 'ban' && <>¿Banear permanentemente a <strong>{confirmAction.memberName}</strong>? Solo podrás deshacerlo manualmente.</>}
            </p>
            <Input
              label="Motivo (opcional, visible para el usuario)"
              placeholder="Deja en blanco para no especificar"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button className="flex-1" variant="danger" disabled={updatingId === confirmAction.memberId}
                onClick={() => doMemberAction(confirmAction.memberId, confirmAction.action, actionReason ? { reason: actionReason } : undefined)}>
                {updatingId === confirmAction.memberId ? 'Procesando...' : confirmAction.action === 'reject' ? 'Sí, rechazar' : confirmAction.action === 'suspend' ? 'Sí, suspender' : 'Sí, banear'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Role change modal ── */}
      {roleModal && (
        <Modal open={roleModal.open} onClose={() => setRoleModal(null)} title={`Cambiar rol — ${roleModal.memberName}`} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Rol actual: <strong>{roleModal.currentRole === 'ADMIN' ? 'Administrador' : 'Socio'}</strong></p>
            <Select
              label="Nuevo rol"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'MEMBER')}
              options={[
                { value: 'MEMBER', label: 'Socio' },
                { value: 'ADMIN', label: 'Administrador' },
              ]}
            />
            <div className="flex gap-2">
              <Button className="flex-1" disabled={updatingId === roleModal.memberId}
                onClick={() => doMemberAction(roleModal.memberId, 'change_role', { role: newRole })}>
                {updatingId === roleModal.memberId ? 'Guardando...' : 'Cambiar rol'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setRoleModal(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── New invitation modal ── */}
      <Modal open={newInvModal} onClose={() => setNewInvModal(false)} title="Nueva invitación" size="md">
        <div className="space-y-4">
          {!generatedLink ? (
            <>
              <div className="flex gap-2">
                {(['EMAIL', 'LINK', 'CODE'] as const).map((ch) => (
                  <button key={ch} onClick={() => setInvChannel(ch)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${invChannel === ch ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {channelIcon(ch)} {ch === 'EMAIL' ? 'Email' : ch === 'LINK' ? 'Enlace' : 'Código'}
                  </button>
                ))}
              </div>

              {invChannel === 'EMAIL' && (
                <Input label="Email del destinatario" type="email" placeholder="socio@email.com"
                  value={invForm.invitedEmail} onChange={(e) => setInvForm({ ...invForm, invitedEmail: e.target.value })} />
              )}

              <Select
                label="Rol asignado al entrar"
                value={invForm.assignedRole}
                onChange={(e) => setInvForm({ ...invForm, assignedRole: e.target.value })}
                options={[
                  { value: 'MEMBER', label: 'Socio' },
                  { value: 'ADMIN', label: 'Administrador' },
                ]}
              />

              <Input label={`Expira en días${invChannel !== 'EMAIL' ? ' (vacío = no expira)' : ''}`}
                type="number" min={1} max={365} placeholder={invChannel === 'EMAIL' ? '7' : 'Sin expiración'}
                value={invForm.expiresInDays || ''} onChange={(e) => setInvForm({ ...invForm, expiresInDays: parseInt(e.target.value) || 0 })} />

              {invChannel !== 'EMAIL' && (
                <Input label="Usos máximos (vacío = ilimitado)" type="number" min={1}
                  placeholder="Ilimitado" value={invForm.maxUses || ''}
                  onChange={(e) => setInvForm({ ...invForm, maxUses: parseInt(e.target.value) || 0 })} />
              )}

              <Input label="Nota interna (no visible para el invitado)" placeholder="Ej: Temporada 2026"
                value={invForm.note} onChange={(e) => setInvForm({ ...invForm, note: e.target.value })} />

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" disabled={invSending} onClick={createInvitation}>
                  {invSending ? 'Procesando...' : invChannel === 'EMAIL' ? 'Enviar invitación' : 'Generar enlace'}
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => setNewInvModal(false)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-green-700 font-medium">✓ {invChannel === 'LINK' ? 'Enlace' : 'Código'} generado</p>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="flex-1 text-sm text-gray-700 break-all font-mono">{generatedLink}</p>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Copiado') }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button className="w-full" variant="outline" onClick={() => setNewInvModal(false)}>Cerrar</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Assign quota modal ── */}
      <Modal open={quotaModal.open} onClose={() => setQuotaModal({ ...quotaModal, open: false })}
        title={`Asignar cuota — ${quotaModal.memberName}`} size="sm">
        <div className="space-y-4">
          <Input label="Año" type="number" value={quotaForm.year}
            onChange={(e) => setQuotaForm({ ...quotaForm, year: parseInt(e.target.value) })} />
          <Input label="Importe (€)" type="number" step="0.01" placeholder="0.00"
            value={quotaForm.amount} onChange={(e) => setQuotaForm({ ...quotaForm, amount: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={assignQuota}>Asignar cuota</Button>
            <Button variant="outline" className="flex-1" onClick={() => setQuotaModal({ ...quotaModal, open: false })}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Import Tab ────────────────────────────────────────────────────────────────

type CsvRow = { nombre: string; email: string; password: string }

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  // Skip header row
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''))
    return { nombre: parts[0] ?? '', email: parts[1] ?? '', password: parts[2] ?? '' }
  }).filter((r) => r.nombre || r.email)
}

function ImportTab({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)

  // Password generator
  const [pwCount, setPwCount] = useState(10)
  const [generatedPws, setGeneratedPws] = useState<string[]>([])

  const downloadTemplate = () => {
    const csv = 'nombre,email,password\nEjemplo Socio,socio@ejemplo.com,Password123'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_socios.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCsv(text))
    }
    reader.readAsText(file)
  }

  const autoGeneratePasswords = () => {
    setRows((prev) => prev.map((r) => ({ ...r, password: generatePassword() })))
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    toast('Funcionalidad próximamente', { icon: '🚧' })
    setImporting(false)
  }

  const generatePasswords = () => {
    const pwds: string[] = []
    for (let i = 0; i < pwCount; i++) pwds.push(generatePassword())
    setGeneratedPws(pwds)
  }

  const copyAllPasswords = () => {
    navigator.clipboard.writeText(generatedPws.join('\n'))
    toast.success('Contraseñas copiadas')
  }

  return (
    <div className="space-y-6 pt-2">
      {/* CSV Import section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Importar socios desde CSV</h3>
          <p className="text-xs text-gray-500">Descarga la plantilla CSV, rellénala y súbela para importar múltiples socios a la vez.</p>
        </div>

        <Button size="sm" variant="outline" onClick={downloadTemplate}>
          <FileText className="h-3.5 w-3.5" /> Descargar plantilla CSV
        </Button>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Subir archivo CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">{rows.length} socios listos para importar</p>
              <Button size="sm" variant="outline" onClick={autoGeneratePasswords}>
                Generar contraseñas automáticamente
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium">Nombre</th>
                    <th className="text-left py-2 px-3 font-medium">Email</th>
                    <th className="text-left py-2 px-3 font-medium">Contraseña</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900">{row.nombre || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-2 px-3 text-gray-600">{row.email || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="py-2 px-3 font-mono text-gray-500 text-xs">
                        {row.password ? '••••••••' : <span className="text-gray-300 italic">sin contraseña</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button disabled={importing} onClick={handleImport}>
              {importing ? 'Importando...' : `Importar ${rows.length} socios`}
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Password generator section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Generador de contraseñas</h3>
          <p className="text-xs text-gray-500">Genera contraseñas aleatorias de 8 caracteres alfanuméricos para asignar a los socios.</p>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Cantidad</label>
            <input
              type="number"
              min={1}
              max={100}
              value={pwCount}
              onChange={(e) => setPwCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button size="sm" onClick={generatePasswords}>Generar contraseñas</Button>
        </div>

        {generatedPws.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">{generatedPws.length} contraseñas generadas</p>
              <Button size="sm" variant="outline" onClick={copyAllPasswords}>
                <Copy className="h-3.5 w-3.5" /> Copiar todas
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {generatedPws.map((pw, i) => (
                <div key={i} className="flex items-center justify-between gap-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-mono text-xs text-gray-700 flex-1">{pw}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(pw); toast.success('Copiado') }}
                    className="text-gray-300 hover:text-primary transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
