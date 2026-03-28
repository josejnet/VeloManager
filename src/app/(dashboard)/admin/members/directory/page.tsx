'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '@/providers/DashboardProvider'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate } from '@/lib/utils'
import {
  Search,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  X,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────

type MemberProfileStatus = 'UNREGISTERED' | 'LINKED'

interface LinkedUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface LinkedMembership {
  id: string
  status: string
  role: string
}

interface MemberProfile {
  id: string
  clubId: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  birthDate: string | null
  jerseyNumber: string | null
  licenseNumber: string | null
  joinDate: string | null
  notes: string | null
  status: MemberProfileStatus
  userId: string | null
  membershipId: string | null
  createdAt: string
  updatedAt: string
  user: LinkedUser | null
  membership: LinkedMembership | null
}

interface PaginatedProfiles {
  data: MemberProfile[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface ImportResult {
  imported: number
  skipped: number
  errors: { row: number; email: string; reason: string }[]
}

type StatusFilter = 'ALL' | 'UNREGISTERED' | 'LINKED'

const EMPTY_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  birthDate: '',
  jerseyNumber: '',
  licenseNumber: '',
  joinDate: '',
  notes: '',
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function ProfileStatusBadge({ status }: { status: MemberProfileStatus }) {
  if (status === 'LINKED') {
    return (
      <Badge variant="success">
        <UserCheck className="h-3 w-3 mr-1" />
        Vinculado
      </Badge>
    )
  }
  return (
    <Badge variant="default">
      <UserX className="h-3 w-3 mr-1" />
      Sin cuenta
    </Badge>
  )
}

// ─── Profile Form ──────────────────────────────────────────────────────────

interface ProfileFormProps {
  form: typeof EMPTY_FORM
  onChange: (field: string, value: string) => void
  isLinked?: boolean
}

function ProfileForm({ form, onChange, isLinked = false }: ProfileFormProps) {
  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Nombre *</label>
          <input
            className={inputClass}
            value={form.firstName}
            onChange={(e) => onChange('firstName', e.target.value)}
            placeholder="Carlos"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Apellidos *</label>
          <input
            className={inputClass}
            value={form.lastName}
            onChange={(e) => onChange('lastName', e.target.value)}
            placeholder="García López"
            required
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Email *
          {isLinked && (
            <span className="ml-2 text-xs text-amber-600 font-normal">
              (no editable — perfil vinculado)
            </span>
          )}
        </label>
        <input
          className={inputClass}
          type="email"
          value={form.email}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="carlos@correo.es"
          disabled={isLinked}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="612 345 678"
          />
        </div>
        <div>
          <label className={labelClass}>Ciudad</label>
          <input
            className={inputClass}
            value={form.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="Madrid"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Dirección</label>
          <input
            className={inputClass}
            value={form.address}
            onChange={(e) => onChange('address', e.target.value)}
            placeholder="Calle Mayor 12, 3º B"
          />
        </div>
        <div>
          <label className={labelClass}>Código Postal</label>
          <input
            className={inputClass}
            value={form.postalCode}
            onChange={(e) => onChange('postalCode', e.target.value)}
            placeholder="28001"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Fecha Nacimiento</label>
          <input
            className={inputClass}
            type="date"
            value={form.birthDate}
            onChange={(e) => onChange('birthDate', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Nº Camiseta</label>
          <input
            className={inputClass}
            value={form.jerseyNumber}
            onChange={(e) => onChange('jerseyNumber', e.target.value)}
            placeholder="7"
          />
        </div>
        <div>
          <label className={labelClass}>Nº Licencia</label>
          <input
            className={inputClass}
            value={form.licenseNumber}
            onChange={(e) => onChange('licenseNumber', e.target.value)}
            placeholder="FED-2024-001"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Fecha Alta</label>
        <input
          className={inputClass}
          type="date"
          value={form.joinDate}
          onChange={(e) => onChange('joinDate', e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>Notas</label>
        <textarea
          className={inputClass + ' resize-none'}
          rows={3}
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          placeholder="Observaciones..."
          maxLength={2000}
        />
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function MemberDirectoryPage() {
  const { clubId } = useDashboard()

  // List state
  const [profiles, setProfiles] = useState<PaginatedProfiles | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detail/edit panel
  const [selectedProfile, setSelectedProfile] = useState<MemberProfile | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createSaving, setCreateSaving] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; profile: MemberProfile | null }>({
    open: false,
    profile: null,
  })
  const [deleting, setDeleting] = useState(false)

  // Import modal
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Fetch profiles ─────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) params.set('q', search)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const res = await fetch(`/api/clubs/${clubId}/member-profiles?${params}`)
      if (res.ok) {
        const data: PaginatedProfiles = await res.json()
        setProfiles(data)
      } else {
        toast.error('Error al cargar el directorio')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [clubId, page, search, statusFilter])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 350)
  }

  const handleStatusFilter = (f: StatusFilter) => {
    setStatusFilter(f)
    setPage(1)
  }

  // ─── Create ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  const handleCreateChange = (field: string, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim()) {
      toast.error('Nombre, apellidos y email son obligatorios')
      return
    }
    setCreateSaving(true)
    try {
      const body: Record<string, string | undefined> = {
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
      }
      if (createForm.phone) body.phone = createForm.phone.trim()
      if (createForm.address) body.address = createForm.address.trim()
      if (createForm.city) body.city = createForm.city.trim()
      if (createForm.postalCode) body.postalCode = createForm.postalCode.trim()
      if (createForm.birthDate) body.birthDate = createForm.birthDate
      if (createForm.jerseyNumber) body.jerseyNumber = createForm.jerseyNumber.trim()
      if (createForm.licenseNumber) body.licenseNumber = createForm.licenseNumber.trim()
      if (createForm.joinDate) body.joinDate = createForm.joinDate
      if (createForm.notes) body.notes = createForm.notes.trim()

      const res = await fetch(`/api/clubs/${clubId}/member-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Socio creado correctamente')
        setCreateOpen(false)
        fetchProfiles()
      } else {
        toast.error(data.error ?? 'Error al crear el perfil')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setCreateSaving(false)
    }
  }

  // ─── Detail / Edit ───────────────────────────────────────────────────────

  const openDetail = (profile: MemberProfile) => {
    setSelectedProfile(profile)
    setEditForm({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      city: profile.city ?? '',
      postalCode: profile.postalCode ?? '',
      birthDate: profile.birthDate ? profile.birthDate.substring(0, 10) : '',
      jerseyNumber: profile.jerseyNumber ?? '',
      licenseNumber: profile.licenseNumber ?? '',
      joinDate: profile.joinDate ? profile.joinDate.substring(0, 10) : '',
      notes: profile.notes ?? '',
    })
    setDetailOpen(true)
  }

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfile) return
    setEditSaving(true)
    try {
      const body: Record<string, string | null | undefined> = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        city: editForm.city.trim() || null,
        postalCode: editForm.postalCode.trim() || null,
        birthDate: editForm.birthDate || null,
        jerseyNumber: editForm.jerseyNumber.trim() || null,
        licenseNumber: editForm.licenseNumber.trim() || null,
        joinDate: editForm.joinDate || null,
        notes: editForm.notes.trim() || null,
      }
      // Only send email if not linked
      if (!selectedProfile.userId) {
        body.email = editForm.email.trim()
      }

      const res = await fetch(`/api/clubs/${clubId}/member-profiles/${selectedProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Perfil actualizado')
        setDetailOpen(false)
        fetchProfiles()
      } else {
        toast.error(data.error ?? 'Error al actualizar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  const confirmDelete = (profile: MemberProfile, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirm({ open: true, profile })
  }

  const handleDelete = async () => {
    if (!deleteConfirm.profile) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/member-profiles/${deleteConfirm.profile.id}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('Perfil eliminado')
        setDeleteConfirm({ open: false, profile: null })
        if (detailOpen && selectedProfile?.id === deleteConfirm.profile.id) {
          setDetailOpen(false)
        }
        fetchProfiles()
      } else {
        toast.error(data.error ?? 'No se pudo eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Import ──────────────────────────────────────────────────────────────

  const openImport = () => {
    setImportFile(null)
    setImportResult(null)
    setImportOpen(true)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setImportFile(f)
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch(`/api/clubs/${clubId}/member-profiles/import`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
        fetchProfiles()
      } else {
        toast.error(data.error ?? 'Error al importar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    if (!clubId) return
    window.location.href = `/api/clubs/${clubId}/member-profiles/template`
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Directorio de socios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los perfiles de socios del club
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openImport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Importar
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Plantilla
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo socio
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por nombre, email, licencia..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
            <button className={tabClass(statusFilter === 'ALL')} onClick={() => handleStatusFilter('ALL')}>
              Todos
            </button>
            <button
              className={tabClass(statusFilter === 'UNREGISTERED')}
              onClick={() => handleStatusFilter('UNREGISTERED')}
            >
              No registrados
            </button>
            <button
              className={tabClass(statusFilter === 'LINKED')}
              onClick={() => handleStatusFilter('LINKED')}
            >
              Vinculados
            </button>
          </div>
        </div>

        {profiles && (
          <p className="text-xs text-gray-500">
            {profiles.total} perfil{profiles.total !== 1 ? 'es' : ''} encontrado{profiles.total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl shadow-sm border border-gray-100 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
            Cargando...
          </div>
        ) : profiles?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileSpreadsheet className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No se encontraron perfiles</p>
            {(search || statusFilter !== 'ALL') && (
              <button
                className="mt-2 text-xs text-blue-600 hover:underline"
                onClick={() => {
                  setSearch('')
                  setSearchInput('')
                  setStatusFilter('ALL')
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre completo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                      Teléfono
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">
                      Ciudad
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">
                      Camiseta
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">
                      Licencia
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {profiles?.data.map((profile) => (
                    <tr
                      key={profile.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openDetail(profile)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {profile.firstName} {profile.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{profile.email}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {profile.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                        {profile.city ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                        {profile.jerseyNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">
                        {profile.licenseNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ProfileStatusBadge status={profile.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetail(profile)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {profile.status === 'UNREGISTERED' && (
                            <button
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="Eliminar"
                              onClick={(e) => confirmDelete(profile, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {profiles && (
              <div className="px-4 pb-4">
                <Pagination
                  page={profiles.page}
                  totalPages={profiles.totalPages}
                  total={profiles.total}
                  pageSize={profiles.pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Detail / Edit Modal ─── */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={
          selectedProfile
            ? `${selectedProfile.firstName} ${selectedProfile.lastName}`
            : 'Detalle del socio'
        }
        size="lg"
      >
        {selectedProfile && (
          <div className="space-y-6">
            {/* Status + linked info */}
            <div className="flex items-center justify-between">
              <ProfileStatusBadge status={selectedProfile.status} />
              {selectedProfile.user && (
                <div className="text-xs text-gray-500">
                  Cuenta vinculada:{' '}
                  <span className="font-medium text-gray-700">
                    {selectedProfile.user.name ?? selectedProfile.user.email}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata row */}
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <div>
                <p className="font-medium text-gray-600">Alta en plataforma</p>
                <p>{fmtDate(selectedProfile.createdAt)}</p>
              </div>
              {selectedProfile.joinDate && (
                <div>
                  <p className="font-medium text-gray-600">Fecha alta club</p>
                  <p>{fmtDate(selectedProfile.joinDate)}</p>
                </div>
              )}
              {selectedProfile.membership && (
                <div>
                  <p className="font-medium text-gray-600">Membresía</p>
                  <p>{selectedProfile.membership.role}</p>
                </div>
              )}
            </div>

            {/* Edit form */}
            <form onSubmit={handleEdit} className="space-y-4">
              <ProfileForm
                form={editForm}
                onChange={handleEditChange}
                isLinked={!!selectedProfile.userId}
              />

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {selectedProfile.status === 'UNREGISTERED' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      setDetailOpen(false)
                      confirmDelete(selectedProfile, e)
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar perfil
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" loading={editSaving}>
                    Guardar cambios
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* ─── Create Modal ─── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo socio"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <ProfileForm form={createForm} onChange={handleCreateChange} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createSaving}>
              Crear socio
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Delete Confirm Modal ─── */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, profile: null })}
        title="Eliminar perfil"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              ¿Seguro que quieres eliminar el perfil de{' '}
              <span className="font-semibold">
                {deleteConfirm.profile?.firstName} {deleteConfirm.profile?.lastName}
              </span>
              ? Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm({ open: false, profile: null })}
            >
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Import Modal ─── */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar socios desde Excel"
        size="lg"
      >
        <div className="space-y-5">
          {!importResult ? (
            <>
              <p className="text-sm text-gray-600">
                Sube un archivo <strong>.xlsx</strong> o <strong>.xls</strong> con los datos de
                los socios. Descarga la{' '}
                <button
                  className="text-blue-600 underline"
                  onClick={handleDownloadTemplate}
                >
                  plantilla de ejemplo
                </button>{' '}
                para ver el formato correcto. Máximo 500 filas.
              </p>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : importFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setImportFile(f)
                  }}
                />
                {importFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-800">{importFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      className="ml-2 text-gray-400 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation()
                        setImportFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Arrastra tu archivo aquí o{' '}
                      <span className="text-blue-600 cursor-pointer">haz clic para seleccionar</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .xls</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile}
                  loading={importing}
                >
                  <Upload className="h-4 w-4" />
                  Importar
                </Button>
              </div>
            </>
          ) : (
            /* Import results */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-xs text-green-600 mt-0.5">Importados</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                  <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center mx-auto mb-1">
                    <span className="text-white text-xs font-bold">S</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-700">{importResult.skipped}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Omitidos (ya existen)</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                  <p className="text-xs text-red-500 mt-0.5">Errores</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Detalle de errores:</p>
                  <div className="border border-red-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-red-600 font-medium">Fila</th>
                          <th className="text-left px-3 py-2 text-red-600 font-medium">Email</th>
                          <th className="text-left px-3 py-2 text-red-600 font-medium">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-50">
                        {importResult.errors.map((e, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-600">{e.row}</td>
                            <td className="px-3 py-1.5 text-gray-600">{e.email}</td>
                            <td className="px-3 py-1.5 text-red-600">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportResult(null)
                    setImportFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  Importar otro archivo
                </Button>
                <Button onClick={() => setImportOpen(false)}>Cerrar</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
