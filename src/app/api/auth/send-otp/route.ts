import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { encryptPayload } from '@/lib/otpCrypto'
import { checkOtpRateLimit } from '@/lib/otpRateLimit'
import { sendOtpEmail } from '@/lib/mailer'

const OTP_TTL_MS = 10 * 60 * 1000

type OtpPayload = { email: string; otp: string; tokenHash: string; expiresAt: number }

function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase()
  // Deliberately loose — this only gates "is it worth spending a rate-limit
  // slot and an SMTP send on this string," not full RFC validation. Supabase
  // itself is the real validator; a malformed address just gets a generic
  // failure from generateLink.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export async function POST(request: NextRequest) {
  const email = normalizeEmail((await request.json().catch(() => ({})))?.email)
  if (!email) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  // Checked before the rate limiter, not after. A misconfigured deployment
  // cannot send anything, so consuming the caller's 60s cooldown for it just
  // locks them out of retrying once it is fixed — and the generic "could not
  // send" this used to return gave no hint that the cause was configuration
  // rather than a transient Gmail problem.
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('OTP send blocked: GMAIL_USER / GMAIL_APP_PASSWORD are not set in this environment.')
    return NextResponse.json(
      { error: 'Email sign-in is not configured on this server. Please use Google sign-in, or contact the organisers.' },
      { status: 503 },
    )
  }

  // Vercel sets x-forwarded-for; a direct/local request has no proxy, hence
  // the fallback rather than leaving the IP bucket empty.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

  let rateLimit
  try {
    rateLimit = await checkOtpRateLimit(email, ip)
  } catch (err) {
    console.error('OTP rate limit check failed:', err)
    return NextResponse.json({ error: 'Could not process this request right now. Please try again.' }, { status: 500 })
  }
  if (!rateLimit.allowed) {
    const message =
      rateLimit.scope === 'email'
        ? `Please wait ${rateLimit.retryAfterSeconds}s before requesting another code.`
        : 'Too many requests from this network. Please try again later.'
    return NextResponse.json({ error: message }, { status: 429 })
  }

  const admin = createAdminClient()

  // `generateLink` creates the Supabase Auth user for type 'magiclink' if one
  // does not already exist, so this same endpoint covers first-time sign-up
  // and every later sign-in — there is no separate "verify this is a new
  // email" branch needed.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('generateLink failed:', linkError)
    return NextResponse.json({ error: 'Could not start sign-in. Please try again.' }, { status: 500 })
  }

  const otp = crypto.randomInt(100000, 1000000).toString()

  try {
    await sendOtpEmail(email, otp)
  } catch (err) {
    // Gmail's own codes are the useful signal here: EAUTH/535 means the app
    // password is wrong or revoked, ECONN* means the SMTP connection itself
    // was refused (the cloud-IP problem this design exists to avoid).
    const code = (err as { code?: string })?.code
    console.error(`OTP email send failed${code ? ` (${code})` : ''}:`, err)
    return NextResponse.json({ error: 'Could not send the verification email. Please try again shortly.' }, { status: 502 })
  }

  const payload: OtpPayload = {
    email,
    otp,
    tokenHash: linkData.properties.hashed_token,
    expiresAt: Date.now() + OTP_TTL_MS,
  }

  return NextResponse.json({ success: true, session: encryptPayload(payload) })
}
