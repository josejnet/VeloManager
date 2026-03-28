import { Skeleton, StatsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function AdminLoading() {
  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header placeholder */}
      <div className="h-14 border-b border-gray-100 px-6 flex items-center">
        <Skeleton className="h-5 w-48" />
      </div>

      <main className="flex-1 p-6 space-y-6">
        <StatsSkeleton count={4} />

        {/* Card placeholder */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <TableSkeleton rows={5} cols={4} />
        </div>
      </main>
    </div>
  )
}
