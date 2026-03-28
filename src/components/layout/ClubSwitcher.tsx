'use client'
import { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ChevronDown, Check, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shape returned by GET /api/clubs — flat club object with myRole
interface ClubItem {
  id: string
  name: string
  sport: string
  colorTheme: string | null
  logoUrl: string | null
  myRole: string
}

interface ClubSwitcherProps {
  userId: string
  currentClubId: string
  onSwitch: (clubId: string) => void
}

const ROLE_LABELS: Record<string, string> = {
  CLUB_ADMIN: 'Admin',
  SOCIO: 'Socio',
  SUPER_ADMIN: 'Super',
}

const ROLE_VARIANTS: Record<string, 'success' | 'warning' | 'info' | 'default' | 'purple'> = {
  CLUB_ADMIN: 'purple',
  SOCIO: 'info',
  SUPER_ADMIN: 'warning',
}

export function ClubSwitcher({ userId: _userId, currentClubId, onSwitch }: ClubSwitcherProps) {
  const [clubs, setClubs] = useState<ClubItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/clubs?pageSize=50')
      .then((r) => r.json())
      .then((d) => { setClubs(d.data ?? []) })
      .catch(() => {})
  }, [])

  const activeClub = clubs.find((c) => c.id === currentClubId)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSwitch = (clubId: string) => {
    document.cookie = `activeClubId=${clubId}; path=/; max-age=31536000; SameSite=Lax`
    setOpen(false)
    onSwitch(clubId)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left max-w-[200px]"
      >
        {/* Club icon */}
        {activeClub?.logoUrl ? (
          <img
            src={activeClub.logoUrl}
            alt={activeClub.name}
            className="h-6 w-6 rounded object-cover shrink-0"
          />
        ) : (
          <div
            className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0"
            style={activeClub?.colorTheme ? { backgroundColor: `${activeClub.colorTheme}22` } : {}}
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate leading-none">
            {activeClub?.name ?? 'Seleccionar club'}
          </p>
          {activeClub && (
            <p className="text-xs text-gray-400 leading-none mt-0.5">
              {ROLE_LABELS[activeClub.myRole] ?? activeClub.myRole}
            </p>
          )}
        </div>

        <ChevronDown
          className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && clubs.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-gray-100 shadow-lg z-50 py-1">
          <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
            Mis clubes
          </p>
          {clubs.map((c) => {
            const isActive = c.id === currentClubId
            return (
              <button
                key={c.id}
                onClick={() => handleSwitch(c.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left',
                  isActive && 'bg-primary/5'
                )}
              >
                {c.logoUrl ? (
                  <img
                    src={c.logoUrl}
                    alt={c.name}
                    className="h-8 w-8 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"
                    style={c.colorTheme ? { backgroundColor: `${c.colorTheme}22` } : {}}
                  >
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-400">{c.sport}</span>
                    <Badge variant={ROLE_VARIANTS[c.myRole] ?? 'default'} className="text-[10px] px-1.5 py-0">
                      {ROLE_LABELS[c.myRole] ?? c.myRole}
                    </Badge>
                  </div>
                </div>

                {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
