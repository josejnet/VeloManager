'use client'
import { useSession } from 'next-auth/react'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface HeaderProps {
  title: string
  clubId: string
}

export function Header({ title, clubId }: HeaderProps) {
  const { data: session } = useSession()
  const user = session?.user as { name?: string | null } | undefined

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationBell clubId={clubId} />
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      </div>
    </header>
  )
}
