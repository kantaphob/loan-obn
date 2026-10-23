import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { getCurrentUser } from '@/lib/auth/current-user'
import { signCardRead } from '@/lib/thai-id-token'
import type { ThaiIdCard } from '@/lib/thai-id'

const execute = promisify(execFile)
let reading = false

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์อ่านบัตร' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) return Response.json({ message: 'ไม่อนุญาตคำขอจากภายนอก' }, { status: 403 })
  if (process.platform !== 'darwin') return Response.json({ message: 'ต้องรันระบบบน Mac ที่เชื่อมต่อเครื่องอ่าน ACS' }, { status: 503 })
  if (reading) return Response.json({ message: 'เครื่องอ่านกำลังใช้งาน กรุณารอสักครู่' }, { status: 409 })
  reading = true
  try {
    const { stdout } = await execute('/usr/bin/python3', [path.join(process.cwd(), 'scripts/read-thai-id.py')], { timeout: 25000, maxBuffer: 128 * 1024 })
    const result: { card: ThaiIdCard } = JSON.parse(stdout)
    if (!result.card?.nationalId || !result.card.photo) throw new Error('Incomplete card data')
    return Response.json({ card: result.card, ...signCardRead(result.card, user.id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    let message = 'อ่านบัตรไม่สำเร็จ กรุณาตรวจสอบเครื่องอ่านและเสียบบัตรใหม่'
    if (error && typeof error === 'object' && 'stdout' in error && typeof error.stdout === 'string') {
      try { message = JSON.parse(error.stdout).message || message } catch { /* Keep generic message; do not log card contents. */ }
    }
    return Response.json({ message }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  } finally { reading = false }
}
