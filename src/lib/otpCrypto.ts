import 'server-only'
import crypto from 'crypto'

/**
 * Encrypts the OTP session payload so it can round-trip through the browser
 * between the send and verify requests without a database row to hold it —
 * the whole point of this flow being "stateless."
 *
 * AES-256-GCM rather than CBC: GCM produces an authentication tag, so a
 * tampered ciphertext fails to decrypt at all. CBC alone is malleable — an
 * attacker can flip ciphertext bits and get back *garbled but successfully
 * decrypted* JSON, so "did JSON.parse throw" is not real tamper detection.
 *
 * The key is derived by hashing OTP_ENCRYPTION_SECRET down to exactly 32
 * bytes with SHA-256, so any string length works and there is no risk of an
 * uneven/predictable key from truncating or padding a JWT by hand. Falls back
 * to SUPABASE_SERVICE_ROLE_KEY only so local setup does not hard-fail before
 * OTP_ENCRYPTION_SECRET is added — set a dedicated secret before deploying,
 * since the service-role key is already the highest-value secret in the
 * project and this reuses it for an unrelated purpose otherwise.
 */
const SECRET = process.env.OTP_ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const KEY = crypto.createHash('sha256').update(SECRET).digest()
const IV_LENGTH = 12 // 96-bit nonce is the size GCM is designed for; 16 (CBC's block size) is not

export function encryptPayload(payload: object): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext].map((b) => b.toString('base64url')).join('.')
}

export function decryptPayload<T>(token: string): T | null {
  try {
    const [ivB64, tagB64, dataB64] = token.split('.')
    if (!ivB64 || !tagB64 || !dataB64) return null

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()])
    return JSON.parse(plaintext.toString('utf8')) as T
  } catch {
    // setAuthTag + final() throws on any tampering or wrong key — this catch
    // is the actual tamper detection, not a fallback for malformed input.
    return null
  }
}
