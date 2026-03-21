import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'
import { sendEmail } from '@/lib/email'

const ShareSchema = z.object({
  // If provided, send email to these addresses; if empty, just return the share link
  emails: z.array(z.string().email()).optional(),
  message: z.string().optional(), // optional personal message
})

// POST /api/clubs/[clubId]/events/[eventId]/share
// Generates (or returns) a share token and optionally emails it
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    include: { _count: { select: { attendees: true } } },
  })
  if (!event) return err('Evento no encontrado', 404)

  const body = await req.json().catch(() => ({}))
  const parsed = ShareSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message, 400)

  // Generate share token if not present
  let shareToken = event.shareToken
  if (!shareToken) {
    shareToken = crypto.randomUUID().replace(/-/g, '')
    await prisma.clubEvent.update({
      where: { id: params.eventId },
      data: { shareToken },
    })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const shareUrl = `${baseUrl}/events/${shareToken}`

  // Send emails if requested
  const sentTo: string[] = []
  if (parsed.data.emails && parsed.data.emails.length > 0) {
    const startDate = new Date(event.startAt).toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const startTime = new Date(event.startAt).toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit',
    })

    for (const email of parsed.data.emails) {
      try {
        await sendEmail({
          to: email,
          subject: `Invitación al evento: ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a;">${event.title}</h2>
              <p style="color: #666; font-size: 15px; line-height: 1.5;">
                ${parsed.data.message || 'Te invitamos a participar en este evento.'}
              </p>
              <table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #888; width: 120px;">📅 Fecha</td><td style="color: #1a1a1a;">${startDate}</td></tr>
                <tr><td style="padding: 8px 0; color: #888;">🕐 Hora</td><td style="color: #1a1a1a;">${startTime}</td></tr>
                ${event.location ? `<tr><td style="padding: 8px 0; color: #888;">📍 Lugar</td><td style="color: #1a1a1a;">${event.location}</td></tr>` : ''}
                ${event.description ? `<tr><td style="padding: 8px 0; color: #888; vertical-align: top;">📝 Descripción</td><td style="color: #1a1a1a;">${event.description}</td></tr>` : ''}
              </table>
              <a href="${shareUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Ver detalles del evento
              </a>
              <p style="margin-top: 24px; color: #aaa; font-size: 12px;">
                Este enlace es público y puede compartirse con cualquier persona.
              </p>
            </div>
          `,
        })
        sentTo.push(email)
      } catch {
        // Continue even if one email fails
      }
    }
  }

  return ok({ shareUrl, shareToken, sentTo })
}
