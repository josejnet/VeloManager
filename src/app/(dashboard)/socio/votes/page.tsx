'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { fmtDate } from '@/lib/utils'
import { CheckCircle2, Vote } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SocioVotesPage() {
  const { clubId } = useClub()

  const { data, isLoading, mutate } = useSWR<any>(
    `/api/clubs/${clubId}/votes?active=false&pageSize=50`
  )
  const votes: any[] = data?.data ?? []

  const castVote = async (voteId: string, optionId: string) => {
    const res = await fetch(`/api/clubs/${clubId}/votes/${voteId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId }),
    })
    if (res.ok) { toast.success('Voto registrado'); mutate() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Votaciones" />
      <main className="flex-1 p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center animate-pulse">Cargando…</p>
        ) : votes.length === 0 ? (
          <Card><p className="text-sm text-gray-400 py-8 text-center">Sin votaciones disponibles</p></Card>
        ) : (
          <div className="space-y-4">
            {votes.map((vote) => {
              const totalVotes = vote._count?.responses ?? 0
              const hasVoted = vote.userVoted
              const myOptionId = vote.userOptionId

              return (
                <Card key={vote.id}>
                  <CardHeader>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>{vote.title}</CardTitle>
                        <Badge variant={vote.active ? 'success' : 'default'}>
                          {vote.active ? 'Activa' : 'Cerrada'}
                        </Badge>
                        {hasVoted && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ya votaste
                          </span>
                        )}
                      </div>
                      {vote.description && <p className="text-sm text-gray-500 mt-0.5">{vote.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {totalVotes} votos · {fmtDate(vote.createdAt)}
                        {vote.closedAt && ` · Cerrada ${fmtDate(vote.closedAt)}`}
                      </p>
                    </div>
                  </CardHeader>

                  <div className="space-y-2">
                    {vote.options?.map((opt: any) => {
                      const count = opt._count?.responses ?? 0
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                      const isMyVote = myOptionId === opt.id
                      const showResults = hasVoted || !vote.active

                      return (
                        <div key={opt.id}
                          onClick={() => vote.active && !hasVoted && castVote(vote.id, opt.id)}
                          className={`relative p-3.5 rounded-xl border-2 transition-all overflow-hidden
                            ${isMyVote ? 'border-primary bg-primary/5' : 'border-gray-100'}
                            ${vote.active && !hasVoted ? 'cursor-pointer hover:border-primary/50 hover:bg-gray-50' : 'cursor-default'}
                          `}
                        >
                          {/* Progress bar (shown after voting or when closed) */}
                          {showResults && (
                            <div
                              className="absolute inset-y-0 left-0 bg-primary/10 rounded-xl transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isMyVote && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                              <span className={`text-sm ${isMyVote ? 'font-semibold text-primary' : 'text-gray-700'}`}>
                                {opt.text}
                              </span>
                            </div>
                            {showResults && (
                              <span className="text-xs font-semibold text-gray-500 ml-2">
                                {count} ({pct}%)
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {vote.active && !hasVoted && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                      <Vote className="h-3.5 w-3.5" />
                      Haz clic en una opción para votar. Solo puedes votar una vez.
                    </p>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
