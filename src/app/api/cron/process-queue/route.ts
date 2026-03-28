import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotificationForMany } from '@/lib/notification-service'
import type { CreateNotificationInput } from '@/lib/notification-service'
import type { NotificationType } from '@prisma/client'

const BATCH_SIZE = 20

type EventReminderPayload = {
  eventId: string
  reminderType: '24h' | '2h'
}

type PaymentReminderPayload = {
  userId: string
  clubId: string
  overdueCount: number
  clubName: string
}

type WeeklyDigestPayload = {
  userId: string
}

type NotificationPayload = {
  inputs: CreateNotificationInput[]
}

async function processEventReminder(payload: EventReminderPayload): Promise<void> {
  const { eventId, reminderType } = payload

  const event = await prisma.clubEvent.findUnique({
    where: { id: eventId },
    include: {
      attendees: {
        where: { status: 'GOING' },
        select: { userId: true },
      },
      club: { select: { name: true } },
    },
  })

  if (!event) return

  const isLong = reminderType === '24h'
  const eventDate = event.startAt.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const inputs: CreateNotificationInput[] = event.attendees.map((a) => ({
    userId: a.userId,
    clubId: event.clubId,
    type: 'EVENT_REMINDER' as NotificationType,
    title: isLong ? `Recordatorio: ${event.title}` : `¡Empieza en 2 horas! ${event.title}`,
    message: isLong
      ? `El evento comienza mañana a las ${eventDate}${event.location ? ` en ${event.location}` : ''}.`
      : `El evento comienza hoy a las ${eventDate}${event.location ? ` en ${event.location}` : ''}.`,
    link: `/events/${event.id}`,
    metadata: { eventId: event.id, reminderType },
  }))

  await createNotificationForMany(inputs)
}

async function processPaymentReminder(payload: PaymentReminderPayload): Promise<void> {
  const { userId, clubId, overdueCount, clubName } = payload

  await createNotificationForMany([
    {
      userId,
      clubId,
      type: 'PAYMENT_DUE' as NotificationType,
      title: 'Tienes cuotas pendientes',
      message:
        overdueCount === 1
          ? `Tienes 1 cuota pendiente de pago en ${clubName}.`
          : `Tienes ${overdueCount} cuotas pendientes de pago en ${clubName}.`,
      link: '/socio/cuotas',
      metadata: { clubId, overdueCount },
    },
  ])
}

async function processNotificationBatch(payload: NotificationPayload): Promise<void> {
  await createNotificationForMany(payload.inputs)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()

  // Atomically claim up to BATCH_SIZE PENDING jobs where scheduledAt <= now
  // We do this by fetching them and updating in a transaction
  const jobsToProcess = await prisma.$transaction(async (tx) => {
    const jobs = await tx.notificationJob.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH_SIZE,
    })

    if (jobs.length === 0) return []

    const ids = jobs.map((j) => j.id)

    await tx.notificationJob.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PROCESSING' },
    })

    return jobs
  })

  let processed = 0

  for (const job of jobsToProcess) {
    try {
      const payload = job.payload as Record<string, unknown>

      switch (job.jobType) {
        case 'event_reminder_24h':
          await processEventReminder(payload as unknown as EventReminderPayload)
          break
        case 'event_reminder_2h':
          await processEventReminder(payload as unknown as EventReminderPayload)
          break
        case 'payment_reminder':
          await processPaymentReminder(payload as unknown as PaymentReminderPayload)
          break
        case 'notification_batch':
          await processNotificationBatch(payload as unknown as NotificationPayload)
          break
        default:
          console.warn(`[process-queue] Unknown job type: ${job.jobType}`)
      }

      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'DONE', processedAt: new Date() },
      })

      processed++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[process-queue] Job ${job.id} (${job.jobType}) failed:`, error)

      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          error: errorMessage,
        },
      })
    }
  }

  return Response.json({ processed })
}
