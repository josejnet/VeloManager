'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge, MemberStatusBadge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'
import { User, Lock, Building2, ExternalLink } from 'lucide-react'

interface ClubMembership {
  id: string
  status: string
  clubRole: string
  club: {
    id: string
    name: string
    sport: string
    colorTheme: string | null
    logoUrl: string | null
  }
}

interface Profile {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  province: string | null
  locality: string | null
  memberships: ClubMembership[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Socio',
  SUPER_ADMIN: 'Superadmin',
}

export default function SocioProfilePage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  // Profile form
  const [profileForm, setProfileForm] = useState({ name: '', province: '', locality: '', avatarUrl: '' })
  const [profileSaving, setProfileSaving] = useState(false)

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data: Profile = await res.json()
        setProfile(data)
        setProfileForm({
          name: data.name ?? '',
          province: data.province ?? '',
          locality: data.locality ?? '',
          avatarUrl: data.avatarUrl ?? '',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user) fetchProfile()
  }, [session, fetchProfile])

  const saveProfile = async () => {
    if (!profileForm.name.trim()) return toast.error('El nombre es obligatorio')
    setProfileSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          province: profileForm.province || null,
          locality: profileForm.locality || null,
          avatarUrl: profileForm.avatarUrl || null,
        }),
      })
      if (res.ok) {
        toast.success('Perfil actualizado')
        fetchProfile()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al guardar')
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const changePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('Completa todos los campos')
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Las contraseñas nuevas no coinciden')
    if (pwForm.newPassword.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
    setPwSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      })
      if (res.ok) {
        toast.success('Contraseña actualizada')
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al cambiar contraseña')
      }
    } finally {
      setPwSaving(false)
    }
  }

  const setActiveClub = (clubId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeClubId', clubId)
      toast.success('Club activo cambiado')
      window.location.href = '/socio'
    }
  }

  const initials = profileForm.name
    ? profileForm.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (loading) {
    return (
      <div className="flex flex-col flex-1 overflow-auto">
        <Header title="Mi perfil" />
        <main className="flex-1 p-6">
          <p className="text-sm text-gray-400 text-center py-16">Cargando...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Mi perfil" />
      <main className="flex-1 p-6 space-y-6 max-w-2xl mx-auto w-full">
        {/* Avatar + identity */}
        <Card>
          <CardHeader>
            <CardTitle>Información personal</CardTitle>
          </CardHeader>
          <div className="flex items-center gap-4 mb-6">
            {profileForm.avatarUrl ? (
              <img
                src={profileForm.avatarUrl}
                alt={profileForm.name}
                className="h-16 w-16 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{profile?.name}</p>
              <p className="text-sm text-gray-400">{profile?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Nombre completo"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              placeholder="Tu nombre"
            />
            <Input
              label="URL del avatar"
              value={profileForm.avatarUrl}
              onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
              placeholder="https://..."
              type="url"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Provincia"
                value={profileForm.province}
                onChange={(e) => setProfileForm({ ...profileForm, province: e.target.value })}
                placeholder="Ej: Barcelona"
              />
              <Input
                label="Localidad"
                value={profileForm.locality}
                onChange={(e) => setProfileForm({ ...profileForm, locality: e.target.value })}
                placeholder="Ej: Sabadell"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveProfile} loading={profileSaving}>
                <User className="h-4 w-4" />
                Guardar cambios
              </Button>
            </div>
          </div>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle>Cambiar contraseña</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Contraseña actual"
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              placeholder="••••••••"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              placeholder="Mínimo 6 caracteres"
            />
            <Input
              label="Confirmar nueva contraseña"
              type="password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              placeholder="Repite la contraseña"
            />
            <div className="flex justify-end pt-2">
              <Button onClick={changePassword} loading={pwSaving} variant="outline">
                <Lock className="h-4 w-4" />
                Cambiar contraseña
              </Button>
            </div>
          </div>
        </Card>

        {/* My clubs */}
        <Card>
          <CardHeader>
            <CardTitle>Mis clubs</CardTitle>
          </CardHeader>
          {!profile?.memberships?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No perteneces a ningún club</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {profile.memberships.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  {/* Color dot or logo */}
                  {m.club.logoUrl ? (
                    <img
                      src={m.club.logoUrl}
                      alt={m.club.name}
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10"
                      style={m.club.colorTheme ? { backgroundColor: `${m.club.colorTheme}22` } : {}}
                    >
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{m.club.name}</p>
                    <p className="text-xs text-gray-400">{m.club.sport}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <MemberStatusBadge status={m.status} />
                    <Badge variant="default">{ROLE_LABELS[m.clubRole] ?? m.clubRole}</Badge>
                    {m.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveClub(m.club.id)}
                        title="Ir a este club"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
