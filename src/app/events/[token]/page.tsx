import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Trophy, Calendar, MapPin, Users, Paperclip, Clock } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: { token: string }
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: 'Entrenamiento',
  RACE: 'Carrera',
  SOCIAL: 'Social',
  MEETING: 'Reunión',
  TRIP: 'Viaje',
  OTHER: 'Evento',
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  TRAINING: 'bg-green-100 text-green-700',
  RACE: 'bg-orange-100 text-orange-700',
  SOCIAL: 'bg-blue-100 text-blue-700',
  MEETING: 'bg-gray-100 text-gray-700',
  TRIP: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-gray-100 text-gray-700',
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function PublicEventPage({ params }: Props) {
  const event = await prisma.clubEvent.findUnique({
    where: { shareToken: params.token },
    include: {
      club: { select: { name: true, logoUrl: true, sport: true } },
      attachments: { orderBy: { createdAt: 'asc' } },
      _count: { select: { attendees: true } },
    },
  })

  if (!event || !event.published) notFound()

  const startAt = new Date(event.startAt)
  const endAt = event.endAt ? new Date(event.endAt) : null
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type
  const typeColor = EVENT_TYPE_COLORS[event.type] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">Clube</span>
          <span className="text-gray-300 mx-1">·</span>
          <span className="text-sm text-gray-500">{event.club.name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Event image */}
        {event.imageUrl && (
          <div className="rounded-2xl overflow-hidden mb-6 aspect-video">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Top */}
          <div className="p-6 border-b border-gray-100">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${typeColor} mb-3`}>
              {typeLabel}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{event.title}</h1>
            <p className="text-sm text-gray-500">{event.club.name} · {event.club.sport}</p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 capitalize">{fmtDate(startAt)}</p>
                {endAt && (
                  <p className="text-sm text-gray-500">
                    Hasta {endAt.toDateString() === startAt.toDateString() ? fmtTime(endAt) : fmtDate(endAt)}
                  </p>
                )}
              </div>
            </div>

            {!event.allDay && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-500 shrink-0" />
                <p className="text-gray-900">{fmtTime(startAt)}{endAt ? ` – ${fmtTime(endAt)}` : ''}</p>
              </div>
            )}

            {event.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
                <p className="text-gray-900">{event.location}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500 shrink-0" />
              <p className="text-gray-900">
                {event._count.attendees} confirmado(s)
                {event.maxAttendees ? ` · Aforo máximo: ${event.maxAttendees}` : ''}
              </p>
            </div>

            {event.description && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{event.description}</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          {event.attachments.length > 0 && (
            <div className="px-6 pb-6">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Documentos adjuntos
              </p>
              <div className="space-y-2">
                {event.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{a.name}</span>
                    </div>
                    {a.size && <span className="text-xs text-gray-400">{fmtSize(a.size)}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer CTA */}
          <div className="px-6 pb-6">
            <Link
              href="/login"
              className="block w-full text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Únete al club para apuntarte
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <span className="font-semibold">Clube</span>
        </p>
      </main>
    </div>
  )
}
