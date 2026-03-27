'use client'
import { useSession } from 'next-auth/react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useClubOptional } from '@/context/ClubContext'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const { data: session } = useSession()
  const user = session?.user as { name?: string | null } | undefined
  const clubCtx = useClubOptional()

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        {clubCtx && <NotificationBell clubId={clubCtx.clubId} />}
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      </div>
    </header>
  )
}
