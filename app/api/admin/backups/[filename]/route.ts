import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getDatabaseBackup } from '@/lib/database-backups'

export async function GET(_request: Request, { params }: RouteContext<'/api/admin/backups/[filename]'>) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return Response.json({ message: 'ไม่มีสิทธิ์ดาวน์โหลดไฟล์สำรองข้อมูล' }, { status: 403 })
  }

  const { filename } = await params
  const backup = await getDatabaseBackup(filename)
  if (!backup) return Response.json({ message: 'ไม่พบไฟล์สำรองข้อมูล' }, { status: 404 })

  const stream = Readable.toWeb(createReadStream(backup.fullPath)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/vnd.sqlite3',
      'Content-Length': String(backup.sizeBytes),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
