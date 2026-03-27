import { cn } from '@/lib/utils'

/**
 * Skeleton primitives — replace "Cargando..." text with layout-preserving placeholders.
 *
 * WHY SKELETONS FEEL FASTER:
 *   1. No layout shift (CLS): the page structure is already visible.
 *   2. The shimmer animation communicates progress, not abandonment.
 *   3. Users can orient themselves before data arrives.
 *
 * USAGE:
 *   Single box:  <Skeleton className="h-4 w-32" />
 *   Table rows:  <TableSkeleton rows={5} cols={4} />
 *   Card:        <CardSkeleton />
 *   Stats row:   <StatsSkeleton count={4} />
 */

// ─── Base pulse block ──────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  )
}

// ─── Table rows ────────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="py-2.5 text-left">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="py-3.5">
                  <Skeleton className={`h-4 ${j === 0 ? 'w-36' : j === cols - 1 ? 'w-16 ml-auto' : 'w-24'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stat cards ────────────────────────────────────────────────────────────

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

// ─── Card content ──────────────────────────────────────────────────────────

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Announcement list ─────────────────────────────────────────────────────

export function AnnouncementSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-20 mt-1" />
        </div>
      ))}
    </div>
  )
}
