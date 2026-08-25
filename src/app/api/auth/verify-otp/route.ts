import { NextResponse, type NextRequest } from 'next/server'
import { decryptPayload } from '@/lib/otpCrypto'

type OtpPayload = { email: string; otp: string; tokenHash: string; expiresAt: number }

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = String(body?.email ?? '').trim().toLowerCase()
  const otp = String(body?.otp ?? '').trim()
  const session = String(body?.session ?? '')

  if (!email || !otp || !session) {
    return NextResponse.json({ error: 'Email, code, and session are required.' }, { status: 400 })
  }

  const payload = decryptPayload<OtpPayload>(session)
  // A failed decrypt covers both a tampered/forged session and a stale one
  // from before OTP_ENCRYPTION_SECRET was last rotated — either way, "start
  // over" is the only correct response, not a more specific error that would
  // help someone probe the format.
  if (!payload) {
    return NextResponse.json({ error: 'This session is invalid. Please request a new code.' }, { status: 400 })
  }
  if (Date.now() > payload.expiresAt) {
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 })
  }
  if (payload.email !== email) {
    return NextResponse.json({ error: 'Email address does not match this session.' }, { status: 400 })
  }
  // Fixed-time comparison: this is the actual secret check in the whole
  // flow, and a 6-digit code has little enough entropy that a timing
  // side-channel is worth closing even though the attempt is also rate
  // limited upstream by the cooldown on send-otp.
  if (!timingSafeEqualStrings(payload.otp, otp)) {
    return NextResponse.json({ error: 'Incorrect code. Please check your email and try again.' }, { status: 400 })
  }

  // The client exchanges this for a real Supabase session via
  // supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) — this route
  // only proves the 6-digit code was correct; Supabase itself issues the JWT.
  return NextResponse.json({ success: true, tokenHash: payload.tokenHash })
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
