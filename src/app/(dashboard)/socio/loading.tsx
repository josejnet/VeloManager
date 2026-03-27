import { Skeleton, StatsSkeleton, CardSkeleton } from '@/components/ui/Skeleton'

export default function SocioLoading() {
  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header placeholder */}
      <div className="h-14 border-b border-gray-100 px-6 flex items-center">
        <Skeleton className="h-5 w-48" />
      </div>

      <main className="flex-1 p-6 space-y-6">
        {/* Club brand banner placeholder */}
        <Skeleton className="h-24 w-full rounded-2xl" />

        <StatsSkeleton count={3} />

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <CardSkeleton lines={3} />
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <CardSkeleton lines={3} />
          </div>
        </div>
      </main>
    </div>
  )
}
