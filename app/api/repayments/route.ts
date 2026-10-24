import { getCurrentUser } from '@/lib/auth/current-user'
import { saveLedger } from '@/app/dashboard/ledger/actions'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return Response.json({ error: 'ไม่มีสิทธิ์รับชำระ' }, { status: 403 })
  const origin = request.headers.get('origin')
  try {
    if (!origin || new URL(origin).host !== request.headers.get('host')) return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 })
  } catch { return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 }) }
  if (Number(request.headers.get('content-length')) > 6 * 1024 * 1024) return Response.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB' }, { status: 413 })
  try {
    const form = await request.formData()
    const input = JSON.parse(String(form.get('input')))
    if (input?.kind !== 'REPAYMENT') return Response.json({ error: 'ประเภทรายการไม่ถูกต้อง' }, { status: 400 })
    const upload = form.get('file')
    const result = await saveLedger(input, upload instanceof File ? upload : null)
    return Response.json(result, { status: 'error' in result ? 400 : 200 })
  } catch { return Response.json({ error: 'ข้อมูลรับชำระไม่ถูกต้อง กรุณาลองอีกครั้ง' }, { status: 400 }) }
}
