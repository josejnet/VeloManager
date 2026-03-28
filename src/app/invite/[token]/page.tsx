'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react'

type InviteInfo = {
  clubId: string
  clubName: string
  clubSport: string
  clubLogoUrl: string | null
  clubColorTheme: string
  channel: 'EMAIL' | 'LINK' | 'CODE'
  assignedRole: string
  expiresAt: string | null
  usesCount: number
  maxUses: number | null
  requiresEmailMatch: boolean
}

type State = 'loading' | 'info' | 'accepting' | 'success' | 'error' | 'already_member'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()

  const [state, setState] = useState<State>('loading')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [resultClubId, setResultClubId] = useState('')
  const [membershipStatus, setMembershipStatus] = useState<'APPROVED' | 'PENDING' | null>(null)

  // 1. Fetch invite info
  useEffect(() => {
    if (!token) return
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json()
          setErrorMsg(d.error ?? 'Invitación no válida')
          setState('error')
          return
        }
        const d = await res.json()
        setInvite(d)
        setState('info')
      })
      .catch(() => {
        setErrorMsg('Error al cargar la invitación')
        setState('error')
      })
  }, [token])

  // 2. Accept invitation
  const accept = async () => {
    if (!session) {
      // Redirect to login with return URL
      signIn(undefined, { callbackUrl: `/invite/${token}` })
      return
    }

    setState('accepting')
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: 'POST' })
      const d = await res.json()

      if (res.ok) {
        setResultClubId(d.clubId)
        setMembershipStatus(d.membershipStatus)
        setState('success')
        return
      }

      if (res.status === 409) {
        // Already a member
        setResultClubId(d.clubId ?? '')
        setState('already_member')
        return
      }

      setErrorMsg(d.error ?? 'No se pudo procesar la invitación')
      setState('error')
    } catch {
      setErrorMsg('Error de red. Inténtalo de nuevo.')
      setState('error')
    }
  }

  const themeColor = invite?.clubColorTheme === 'red' ? '#ef4444'
    : invite?.clubColorTheme === 'green' ? '#22c55e'
    : invite?.clubColorTheme === 'orange' ? '#f97316'
    : invite?.clubColorTheme === 'purple' ? '#a855f7'
    : '#2563eb'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Loading */}
        {state === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="h-10 w-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Cargando invitación...</p>
          </div>
        )}

        {/* Invite info — ready to accept */}
        {state === 'info' && invite && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header with club color */}
            <div className="h-2" style={{ background: themeColor }} />
            <div className="p-8">
              {/* Club logo / initial */}
              <div className="flex justify-center mb-6">
                {invite.clubLogoUrl ? (
                  <img src={invite.clubLogoUrl} alt={invite.clubName} className="h-20 w-20 rounded-2xl object-contain border border-gray-100 shadow-sm" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-sm"
                    style={{ background: themeColor }}>
                    {invite.clubName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="text-center mb-6">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{invite.clubSport}</p>
                <h1 className="text-2xl font-bold text-gray-900">{invite.clubName}</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Has sido invitado a unirte como{' '}
                  <strong>{invite.assignedRole === 'ADMIN' ? 'Administrador' : 'Socio'}</strong>
                </p>
              </div>

              {/* Meta */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
                {invite.expiresAt && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Expira el {new Date(invite.expiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
                {invite.maxUses != null && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{invite.maxUses - invite.usesCount} uso{invite.maxUses - invite.usesCount !== 1 ? 's' : ''} disponible{invite.maxUses - invite.usesCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {invite.requiresEmailMatch && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <span>⚠️ Esta invitación es personal — debes acceder con el email al que fue enviada.</span>
                  </div>
                )}
              </div>

              {sessionStatus === 'loading' ? (
                <Button className="w-full" disabled>Cargando sesión...</Button>
              ) : session ? (
                <Button className="w-full" style={{ background: themeColor }} onClick={accept}>
                  Unirme a {invite.clubName}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button className="w-full" style={{ background: themeColor }} onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })}>
                    Iniciar sesión para aceptar
                  </Button>
                  <p className="text-center text-xs text-gray-400">
                    ¿Sin cuenta?{' '}
                    <a href={`/register?invite=${token}`} className="text-blue-600 hover:underline">Regístrate aquí</a>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accepting (spinner) */}
        {state === 'accepting' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="h-10 w-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Procesando tu acceso...</p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {membershipStatus === 'APPROVED' ? '¡Bienvenido!' : 'Solicitud enviada'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {membershipStatus === 'APPROVED'
                ? `Ya eres miembro de ${invite?.clubName}. Puedes acceder al club ahora.`
                : 'Tu solicitud está pendiente de aprobación. Te notificaremos cuando sea revisada.'}
            </p>
            {membershipStatus === 'APPROVED' ? (
              <Button className="w-full" onClick={() => router.push('/socio')}>
                Ir al club
              </Button>
            ) : (
              <Button className="w-full" variant="outline" onClick={() => router.push('/')}>
                Volver al inicio
              </Button>
            )}
          </div>
        )}

        {/* Already member */}
        {state === 'already_member' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <CheckCircle className="h-14 w-14 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ya eres miembro</h2>
            <p className="text-sm text-gray-500 mb-6">Ya perteneces a este club. Accede a tu panel para continuar.</p>
            <Button className="w-full" onClick={() => router.push('/socio')}>
              Ir al panel
            </Button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <XCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invitación no válida</h2>
            <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Volver al inicio
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">VeloManager · Gestión de clubs deportivos</p>
      </div>
    </div>
  )
}
