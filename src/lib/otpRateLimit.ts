import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Protects the sending Gmail account from the two things that get an account
 * flagged or hit its 500/day cap: a single address hammering "resend", and a
 * burst from one network. Backed by the check_otp_rate_limit() Postgres
 * function (0005_otp_rate_limit.sql), which locks and checks atomically —
 * this is a thin client for it, not where the limiting logic lives.
 */
const COOLDOWN_SECONDS = 60
const MAX_PER_EMAIL_PER_HOUR = 5
const MAX_PER_IP_PER_HOUR = 15
const WINDOW_SECONDS = 60 * 60

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number; scope: 'email' | 'ip' }

export async function checkOtpRateLimit(email: string, ip: string): Promise<RateLimitResult> {
  const supabase = createAdminClient()

  const { data: emailCheck, error: emailError } = await supabase.rpc('check_otp_rate_limit', {
    p_key: `email:${email.toLowerCase().trim()}`,
    p_cooldown_seconds: COOLDOWN_SECONDS,
    p_max_per_window: MAX_PER_EMAIL_PER_HOUR,
    p_window_seconds: WINDOW_SECONDS,
  })
  if (emailError) throw new Error(`Rate limit check failed: ${emailError.message}`)
  const emailRow = emailCheck?.[0]
  if (!emailRow?.allowed) {
    return { allowed: false, retryAfterSeconds: emailRow?.retry_after_seconds ?? COOLDOWN_SECONDS, scope: 'email' }
  }

  // The IP check has no cooldown of its own — it exists to cap total volume
  // from one network, not to slow down a single legitimate sender.
  const { data: ipCheck, error: ipError } = await supabase.rpc('check_otp_rate_limit', {
    p_key: `ip:${ip}`,
    p_cooldown_seconds: 0,
    p_max_per_window: MAX_PER_IP_PER_HOUR,
    p_window_seconds: WINDOW_SECONDS,
  })
  if (ipError) throw new Error(`Rate limit check failed: ${ipError.message}`)
  const ipRow = ipCheck?.[0]
  if (!ipRow?.allowed) {
    return { allowed: false, retryAfterSeconds: ipRow?.retry_after_seconds ?? WINDOW_SECONDS, scope: 'ip' }
  }

  return { allowed: true }
}
