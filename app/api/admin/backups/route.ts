import { getCurrentUser } from '@/lib/auth/current-user'
import { createDatabaseBackup, listDatabaseBackups } from '@/lib/database-backups'

async function authorizeAdmin() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return Response.json({ message: 'ไม่มีสิทธิ์จัดการไฟล์สำรองข้อมูล' }, { status: 403 })
  }
  return null
}

export async function GET() {
  const denied = await authorizeAdmin()
  if (denied) return denied

  try {
    return Response.json({ backups: await listDatabaseBackups() })
  } catch (error) {
    console.error('List database backups failed:', error)
    return Response.json({ message: 'ไม่สามารถอ่านรายการสำรองข้อมูลได้' }, { status: 500 })
  }
}

export async function POST() {
  const denied = await authorizeAdmin()
  if (denied) return denied

  try {
    const backup = await createDatabaseBackup()
    return Response.json({ backup }, { status: 201 })
  } catch (error) {
    console.error('Create database backup failed:', error)
    return Response.json({ message: 'สร้างไฟล์สำรองข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}
