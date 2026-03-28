/**
 * Weekly digest email template.
 */

interface PendingQuota {
  period: string
  amount: string
}

interface UpcomingEvent {
  title: string
  date: string
  location?: string
}

interface PendingOrder {
  windowTitle: string
  status: string
}

interface WeeklyDigestData {
  userName: string
  clubName: string
  pendingQuotas: PendingQuota[]
  upcomingEvents: UpcomingEvent[]
  pendingOrders: PendingOrder[]
  dashboardUrl: string
}

export function weeklyDigestEmail(data: WeeklyDigestData): { subject: string; html: string } {
  const { userName, clubName, pendingQuotas, upcomingEvents, pendingOrders, dashboardUrl } = data

  const quotasSection =
    pendingQuotas.length > 0
      ? `
      <div style="margin-bottom:32px">
        <h2 style="color:#111827;font-size:18px;font-weight:600;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #2563eb">
          Cuotas pendientes
        </h2>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:10px 12px;font-size:13px;color:#6b7280;font-weight:500;border-radius:4px 0 0 4px">Período</th>
              <th style="text-align:right;padding:10px 12px;font-size:13px;color:#6b7280;font-weight:500;border-radius:0 4px 4px 0">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${pendingQuotas
              .map(
                (q, i) => `
              <tr style="border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#ffffff' : '#fafafa'}">
                <td style="padding:10px 12px;font-size:14px;color:#374151">${q.period}</td>
                <td style="padding:10px 12px;font-size:14px;color:#dc2626;font-weight:600;text-align:right">${q.amount}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : ''

  const eventsSection =
    upcomingEvents.length > 0
      ? `
      <div style="margin-bottom:32px">
        <h2 style="color:#111827;font-size:18px;font-weight:600;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #2563eb">
          Próximos eventos
        </h2>
        <div>
          ${upcomingEvents
            .map(
              (e) => `
            <div style="display:flex;align-items:flex-start;padding:12px;margin-bottom:8px;background:#f8faff;border-radius:8px;border-left:3px solid #2563eb">
              <div style="flex:1">
                <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#111827">${e.title}</p>
                <p style="margin:0;font-size:13px;color:#6b7280">${e.date}${e.location ? ` · ${e.location}` : ''}</p>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
      : ''

  const ordersSection =
    pendingOrders.length > 0
      ? `
      <div style="margin-bottom:32px">
        <h2 style="color:#111827;font-size:18px;font-weight:600;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #2563eb">
          Mis pedidos
        </h2>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:10px 12px;font-size:13px;color:#6b7280;font-weight:500;border-radius:4px 0 0 4px">Campaña</th>
              <th style="text-align:left;padding:10px 12px;font-size:13px;color:#6b7280;font-weight:500;border-radius:0 4px 4px 0">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${pendingOrders
              .map(
                (o, i) => `
              <tr style="border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#ffffff' : '#fafafa'}">
                <td style="padding:10px 12px;font-size:14px;color:#374151">${o.windowTitle}</td>
                <td style="padding:10px 12px;font-size:14px;color:#374151">
                  <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:500;background:#fef3c7;color:#92400e">${o.status}</span>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : ''

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Resumen semanal — ${clubName}</title>
    </head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif">
      <div style="max-width:600px;margin:0 auto;padding:24px 16px">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);border-radius:12px 12px 0 0;padding:32px 32px 24px 32px;text-align:center">
          <h1 style="margin:0 0 4px 0;color:#ffffff;font-size:24px;font-weight:700">${clubName}</h1>
          <p style="margin:0;color:#bfdbfe;font-size:14px">Resumen semanal</p>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

          <p style="margin:0 0 24px 0;font-size:15px;color:#374151">
            Hola <strong>${userName}</strong>, aquí tienes tu resumen semanal de actividad en el club.
          </p>

          ${quotasSection}
          ${eventsSection}
          ${ordersSection}

          ${!quotasSection && !eventsSection && !ordersSection ? `
          <p style="text-align:center;color:#6b7280;font-size:14px;padding:24px 0">
            No hay novedades pendientes esta semana. ¡Todo al día!
          </p>
          ` : ''}

          <!-- CTA -->
          <div style="text-align:center;margin-top:32px">
            <a href="${dashboardUrl}"
               style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.025em">
              Ir al dashboard
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="text-align:center;padding:24px 16px">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            Recibes este correo porque tienes activada la notificación por email.<br />
            Para desactivarla, accede a
            <a href="${dashboardUrl}/notifications" style="color:#2563eb;text-decoration:none">preferencias de notificaciones</a>.
          </p>
        </div>

      </div>
    </body>
    </html>
  `

  return {
    subject: `[${clubName}] Tu resumen semanal`,
    html,
  }
}
