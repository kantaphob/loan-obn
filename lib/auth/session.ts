import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'loan_session'

export type SessionPayload = { userId: string; expiresAt: number }

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters')
  return secret
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(userId: string, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt } satisfies SessionPayload)).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null
  try {
    const [payload, receivedSignature, extra] = token.split('.')
    if (!payload || !receivedSignature || extra) return null
    const expectedSignature = Buffer.from(signature(payload))
    const actualSignature = Buffer.from(receivedSignature)
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null

    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof decoded !== 'object' || decoded === null) return null
    const { userId, expiresAt } = decoded as Partial<SessionPayload>
    if (typeof userId !== 'string' || !userId || typeof expiresAt !== 'number' || expiresAt <= Date.now()) return null
    return { userId, expiresAt }
  } catch {
    return null
  }
}
