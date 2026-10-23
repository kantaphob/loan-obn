import { getCurrentUser } from '@/lib/auth/current-user'
import { readThaiIdCard, ThaiIdReaderError, waitForThaiIdCard } from '@/lib/read-thai-id-card'
import { signCardRead } from '@/lib/thai-id-token'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์อ่านบัตร' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) return Response.json({ message: 'ไม่อนุญาตคำขอจากภายนอก' }, { status: 403 })
  try {
    const cardPresent = await waitForThaiIdCard(request.signal)
    return Response.json({ cardPresent }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ตรวจจับเครื่องอ่านบัตรไม่สำเร็จ'
    const status = error instanceof ThaiIdReaderError ? error.status : 503
    return Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์อ่านบัตร' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) return Response.json({ message: 'ไม่อนุญาตคำขอจากภายนอก' }, { status: 403 })
  try {
    const card = await readThaiIdCard()
    return Response.json({ card, ...signCardRead(card, user.id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'อ่านบัตรไม่สำเร็จ กรุณาตรวจสอบเครื่องอ่าน'
    const status = error instanceof ThaiIdReaderError ? error.status : 503
    return Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
