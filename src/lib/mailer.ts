import 'server-only'
import nodemailer from 'nodemailer'

/**
 * A pooled transporter reused across requests in the same warm serverless
 * instance, rather than opening a new SMTP/TLS handshake per OTP. Module
 * scope means it survives between invocations as long as the instance does —
 * new cold starts create their own, which is fine, since pooling within one
 * instance is what actually saves the handshake cost.
 */
let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set to send OTP emails.')
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  })
  return transporter
}

export async function sendOtpEmail(to: string, otp: string) {
  const fromName = process.env.EMAIL_FROM_NAME || 'CESA'
  const user = process.env.GMAIL_USER

  await getTransporter().sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `Your verification code: ${otp}`,
    html: `
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
    `,
  })
}
