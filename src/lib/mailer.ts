import 'server-only'
import nodemailer from 'nodemailer'

/**
 * Two ways to send, picked by which credentials exist.
 *
 * Brevo (HTTP) is the one that works in production. Gmail SMTP does not:
 * Google rejects AUTH from data-centre IP ranges with
 * `535-5.7.8 Username and Password not accepted`, even when the app password
 * is provably valid — the same credentials send fine from a laptop and are
 * refused from Vercel. That is the very failure otp.md was written to dodge on
 * Supabase's servers; it assumed "your own server" would be trusted, but
 * serverless is a data centre too. An HTTP API sidesteps SMTP auth entirely.
 *
 * Gmail is kept as the local-development path because it needs no third-party
 * signup, and `localhost` is a residential IP that Google does accept.
 */

export type MailerProvider = 'brevo' | 'gmail' | null

export function activeProvider(): MailerProvider {
  if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM_ADDRESS) return 'brevo'
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail'
  return null
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  })
  return transporter
}

function otpHtml(fromName: string, otp: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Verify your identity</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5; text-align: center;">
        Use this one-time code to sign in to ${fromName}. It is valid for 10 minutes.
      </p>
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #8c1515; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `
}

export async function sendOtpEmail(to: string, otp: string) {
  const fromName = process.env.EMAIL_FROM_NAME || 'CESA'
  const subject = `Your verification code: ${otp}`
  const provider = activeProvider()

  if (provider === 'brevo') {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY as string,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: process.env.EMAIL_FROM_ADDRESS },
        to: [{ email: to }],
        subject,
        htmlContent: otpHtml(fromName, otp),
      }),
    })

    if (!res.ok) {
      // Brevo returns a JSON body with a `message` explaining the refusal —
      // most often an unverified sender address, which is silent otherwise.
      const detail = await res.text().catch(() => '')
      throw new Error(`Brevo rejected the send (${res.status}): ${detail.slice(0, 300)}`)
    }
    return
  }

  if (provider === 'gmail') {
    await getTransporter().sendMail({
      from: `"${fromName}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: otpHtml(fromName, otp),
    })
    return
  }

  throw new Error('No email provider is configured (set BREVO_API_KEY + EMAIL_FROM_ADDRESS, or GMAIL_USER + GMAIL_APP_PASSWORD).')
}
