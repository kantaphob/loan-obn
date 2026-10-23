import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ThaiIdCard } from './thai-id'

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Session secret missing')
  return createHmac('sha256', secret).update('thai-id-card:' + payload).digest('base64url')
}
export function signCardRead(card: ThaiIdCard, userId: string) {
  const readAt = new Date().toISOString()
  const payload = Buffer.from(JSON.stringify({ card, userId, readAt, expiresAt: Date.now() + 30 * 60 * 1000 })).toString('base64url')
  return { token: `${payload}.${sign(payload)}`, readAt }
}
export function verifyCardRead(token: unknown, userId: string): { card: ThaiIdCard; readAt: string } | null {
  if (typeof token !== 'string' || token.length > 50000) return null
  try {
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra) return null
    const expected = Buffer.from(sign(payload)), actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const result = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (result.userId !== userId || result.expiresAt <= Date.now() || !result.card?.nationalId) return null
    return { card: result.card, readAt: result.readAt }
  } catch { return null }
}
