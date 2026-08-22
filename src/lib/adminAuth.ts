import 'server-only'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'cesa_admin'

/**
 * A separate, shared admin credential — not a Supabase Auth user, not tied
 * to anyone's member profile. Session value is an HMAC of a fixed label
 * under ADMIN_PASSWORD, so a stolen cookie only replays a session and can
 * never be used to recover the password, and the cookie becomes invalid the
 * moment ADMIN_PASSWORD is rotated.
 */
function sessionToken(): string {
  const secret = process.env.ADMIN_PASSWORD || ''
  return crypto.createHmac('sha256', secret).update('cesa-admin-session').digest('hex')
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD
  if (!expectedUser || !expectedPass) return false
  // Fixed-time comparison — a login form is exactly the kind of endpoint a
  // timing attack targets, and constant-time compare costs nothing here.
  const userOk = timingSafeEqual(username, expectedUser)
  const passOk = timingSafeEqual(password, expectedPass)
  return userOk && passOk
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // Still do a comparison of equal-length buffers so the branch above
    // doesn't leak length via timing on its own.
    crypto.timingSafeEqual(ab, ab)
    return false
  }
  return crypto.timingSafeEqual(ab, bb)
}

export async function setAdminSession() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours — an admin shift, not a standing login
    path: '/',
  })
}

export async function clearAdminSession() {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies()
  const value = jar.get(COOKIE_NAME)?.value
  if (!value || !process.env.ADMIN_PASSWORD) return false
  return timingSafeEqual(value, sessionToken())
}
