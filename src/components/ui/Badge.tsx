import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// Preset badge mappers
export function MemberStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    APPROVED: { label: 'Aprobado', variant: 'success' },
    PENDING: { label: 'Pendiente', variant: 'warning' },
    REJECTED: { label: 'Rechazado', variant: 'danger' },
    SUSPENDED: { label: 'Suspendido', variant: 'default' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function QuotaStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PAID: { label: 'Pagada', variant: 'success' },
    PENDING: { label: 'Pendiente', variant: 'warning' },
    OVERDUE: { label: 'Vencida', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING: { label: 'Pendiente', variant: 'warning' },
    CONFIRMED: { label: 'Confirmado', variant: 'info' },
    DELIVERED: { label: 'Entregado', variant: 'success' },
    CANCELLED: { label: 'Cancelado', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function WindowStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: 'Borrador', variant: 'default' },
    OPEN: { label: 'Abierta', variant: 'success' },
    CLOSED: { label: 'Cerrada', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
