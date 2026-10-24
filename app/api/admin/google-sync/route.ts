import { getCurrentUser } from '@/lib/auth/current-user'
import { enqueueAllGoogleSync, googleSyncStatus, processGoogleSyncQueue } from '@/lib/google-sync'
import { isGoogleBridgeConfigured } from '@/lib/google-integration'
import { prisma } from '@/lib/prisma'

async function authorized() {
  const user = await getCurrentUser()
  return user?.status === 'ACTIVE' && ['ADMIN', 'SUPER_ADMIN'].includes(user.role)
}
export async function GET() {
  if (!await authorized()) return Response.json({ message: 'ไม่มีสิทธิ์ดูสถานะซิงก์' }, { status: 403 })
  return Response.json(await googleSyncStatus(), { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ message: 'ไม่มีสิทธิ์ซิงก์ข้อมูล' }, { status: 403 })
  try {
    if (new URL(request.headers.get('origin') || '').host !== request.headers.get('host')) return Response.json({ message: 'คำขอไม่ถูกต้อง' }, { status: 403 })
  } catch { return Response.json({ message: 'คำขอไม่ถูกต้อง' }, { status: 403 }) }
  if (!isGoogleBridgeConfigured()) return Response.json({ message: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Google' }, { status: 503 })
  try {
    const retry = new URL(request.url).searchParams.get('retry') === '1'
    const queued = retry ? 0 : await enqueueAllGoogleSync()
    if (retry) await prisma.googleSyncJob.updateMany({ where: { status: 'FAILED' }, data: { status: 'PENDING', nextAttemptAt: new Date() } })
    await processGoogleSyncQueue(10)
    return Response.json({ success: true, queued, ...await googleSyncStatus() })
  } catch {
    return Response.json({ message: 'เตรียมคิวซิงก์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
