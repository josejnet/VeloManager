'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { fmtDate } from '@/lib/utils'
import { CheckCircle2, Vote, Clock, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

// Client-side mirror of backend voteStatus()
function computeStatus(vote: { active: boolean; startsAt: string | null; endsAt: string | null }): 'scheduled' | 'active' | 'closed' {
  if (!vote.active) return 'closed'
  const now = new Date()
  if (vote.startsAt && new Date(vote.startsAt) > now) return 'scheduled'
  if (vote.endsAt && new Date(vote.endsAt) <= now) return 'closed'
  return 'active'
}

export default function SocioVotesPage() {
  const { clubId } = useClub()
  const [voting, setVoting] = useState<string | null>(null)

  const { data, isLoading, error, mutate } = useSWR<any>(
    clubId ? `/api/clubs/${clubId}/votes?active=false&pageSize=50` : null
  )
  const votes: any[] = data?.data ?? []

  const castVote = async (voteId: string, optionId: string) => {
    setVoting(optionId)
    const res = await fetch(`/api/clubs/${clubId}/votes/${voteId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId }),
    })
    setVoting(null)
    if (res.ok) { toast.success('Voto registrado'); mutate() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const activeVotes = votes.filter((v) => computeStatus(v) === 'active')
  const scheduledVotes = votes.filter((v) => computeStatus(v) === 'scheduled')
  const closedVotes = votes.filter((v) => computeStatus(v) === 'closed')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Votaciones" />
      <main className="flex-1 p-6 space-y-6">
        {isLoading && (
          <p className="text-sm text-gray-400 py-8 text-center animate-pulse">Cargando…</p>
        )}

        {!isLoading && error && (
          <Card><p className="text-sm text-red-500 py-8 text-center">Error al cargar las votaciones. Intenta de nuevo.</p></Card>
        )}

        {!isLoading && !error && votes.length === 0 && (
          <Card><p className="text-sm text-gray-400 py-8 text-center">No hay votaciones disponibles aún.</p></Card>
        )}

        {/* Active votes — can vote */}
        {activeVotes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Votaciones activas</h2>
            <div className="space-y-4">
              {activeVotes.map((vote) => <VoteCard key={vote.id} vote={vote} status="active" voting={voting} onVote={castVote} />)}
            </div>
          </section>
        )}

        {/* Scheduled votes — coming soon */}
        {scheduledVotes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Próximas votaciones</h2>
            <div className="space-y-4">
              {scheduledVotes.map((vote) => <VoteCard key={vote.id} vote={vote} status="scheduled" voting={null} onVote={castVote} />)}
            </div>
          </section>
        )}

        {/* Closed votes — results only */}
        {closedVotes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Historial</h2>
            <div className="space-y-4">
              {closedVotes.map((vote) => <VoteCard key={vote.id} vote={vote} status="closed" voting={null} onVote={castVote} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function VoteCard({
  vote,
  status,
  voting,
  onVote,
}: {
  vote: any
  status: 'active' | 'scheduled' | 'closed'
  voting: string | null
  onVote: (voteId: string, optionId: string) => void
}) {
  const totalVotes = vote._count?.responses ?? 0
  const hasVoted = vote.userVoted
  const myOptionId = vote.userOptionId
  const canVote = status === 'active' && !hasVoted

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{vote.title}</CardTitle>
            {status === 'active' && <Badge variant="success">Activa</Badge>}
            {status === 'scheduled' && (
              <Badge variant="warning" className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Programada
              </Badge>
            )}
            {status === 'closed' && <Badge variant="default">Cerrada</Badge>}
            {hasVoted && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ya votaste
              </span>
            )}
          </div>
          {vote.description && <p className="text-sm text-gray-500 mt-0.5">{vote.description}</p>}
          <p className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3">
            <span>{totalVotes} votos</span>
            {vote.startsAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Inicia {fmtDate(vote.startsAt)}
              </span>
            )}
            {vote.endsAt && status !== 'closed' && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Cierra {fmtDate(vote.endsAt)}
              </span>
            )}
            {vote.closedAt && status === 'closed' && (
              <span>Cerrada {fmtDate(vote.closedAt)}</span>
            )}
          </p>
        </div>
      </CardHeader>

      {status === 'scheduled' ? (
        <p className="text-sm text-gray-400 flex items-center gap-2 py-2">
          <Clock className="h-4 w-4" />
          Esta votación aún no ha comenzado. Comienza el {fmtDate(vote.startsAt)}.
        </p>
      ) : (
        <div className="space-y-2">
          {vote.options?.map((opt: any) => {
            const count = opt._count?.responses ?? 0
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            const isMyVote = myOptionId === opt.id
            const showResults = hasVoted || status === 'closed'
            const isVoting = voting === opt.id

            return (
              <div
                key={opt.id}
                onClick={() => canVote && !isVoting && onVote(vote.id, opt.id)}
                className={`relative p-3.5 rounded-xl border-2 transition-all overflow-hidden
                  ${isMyVote ? 'border-primary bg-primary/5' : 'border-gray-100'}
                  ${canVote && !isVoting ? 'cursor-pointer hover:border-primary/50 hover:bg-gray-50' : 'cursor-default'}
                  ${isVoting ? 'opacity-60' : ''}
                `}
              >
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
      )}

      {canVote && (
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
          <Vote className="h-3.5 w-3.5" />
          Haz clic en una opción para votar. Solo puedes votar una vez.
        </p>
      )}
    </Card>
  )
}
