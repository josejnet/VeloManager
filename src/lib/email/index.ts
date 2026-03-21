/**
 * Email service abstraction.
 * In production, connect to Resend, SendGrid, Nodemailer, etc.
 * Set EMAIL_PROVIDER=resend and RESEND_API_KEY in .env
 *
 * Currently: logs to console in dev, real sending stub for prod.
 */

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Email - DEV]', {
      to: payload.to,
      subject: payload.subject,
    })
    return
  }

  // ── Resend (recommended) ─────────────────────────────────────────────────
  const provider = process.env.EMAIL_PROVIDER ?? 'console'

  if (provider === 'resend') {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'noreply@clube.app',
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo,
    })
    return
  }

  console.warn('[Email] No provider configured, email not sent:', payload.subject)
}

// ── Template helpers ──────────────────────────────────────────────────────

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: 'Recuperar contraseña — Clube',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Clube</h2>
        <p>Hola <strong>${name}</strong>,</p>
        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Restablecer contraseña
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">Este enlace caduca en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  }
}

export function clubMessageEmail(clubName: string, senderName: string, subject: string, body: string, dashboardUrl: string) {
  return {
    subject: `[${clubName}] ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e3a5f">${clubName}</h2>
        <p><strong>Mensaje de:</strong> ${senderName}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
        <h3 style="color:#111827">${subject}</h3>
        <div style="color:#374151;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#6b7280;font-size:13px">
          <a href="${dashboardUrl}" style="color:#2563eb">Ver en Clube</a>
        </p>
      </div>
    `,
  }
}
