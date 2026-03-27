'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { fmtDateTime } from '@/lib/utils'
import { ShieldCheck } from 'lucide-react'

const ENTITY_COLORS: Record<string, string> = {
  Invoice: 'bg-orange-100 text-orange-700',
  MemberQuota: 'bg-green-100 text-green-700',
  Member: 'bg-blue-100 text-blue-700',
  Order: 'bg-purple-100 text-purple-700',
  Vote: 'bg-yellow-100 text-yellow-700',
  PurchaseWindow: 'bg-pink-100 text-pink-700',
  Club: 'bg-gray-100 text-gray-700',
  Transaction: 'bg-teal-100 text-teal-700',
}

export default function AuditPage() {
  const { clubId } = useClub()
  const [page, setPage] = useState(1)
  const [entityFilter, setEntityFilter] = useState('')

  const url = `/api/clubs/${clubId}/audit?page=${page}${entityFilter ? `&entity=${entityFilter}` : ''}`
  const { data, isLoading } = useSWR<any>(url, { keepPreviousData: true })

  const entityOptions = [
    { value: '', label: 'Todas las entidades' },
    ...Object.keys(ENTITY_COLORS).map((e) => ({ value: e, label: e })),
  ]

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Log de Auditoría" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Registro de eventos</CardTitle>
            </div>
            <div className="w-48">
              <Select
                options={entityOptions}
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }}
              />
            </div>
          </CardHeader>

          <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Este registro es inmutable. Muestra todas las acciones relevantes en el club.
          </p>

          {isLoading && !data ? (
            <TableSkeleton rows={10} cols={3} />
          ) : (
            <div className={`transition-opacity duration-150 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
              <div className="space-y-0 divide-y divide-gray-50">
                {data?.data?.map((log: any) => (
                  <div key={log.id} className="py-3 flex items-start gap-3">
                    <div className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${ENTITY_COLORS[log.entity] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.entity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{log.action.replaceAll('_', ' ')}</span>
                        <span className="text-xs text-gray-400">por {log.user?.name}</span>
                      </div>
                      {log.details && (
                        <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmtDateTime(log.createdAt)}</span>
                  </div>
                ))}
              </div>
              {data && (
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
