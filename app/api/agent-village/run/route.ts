import '@/lib/agent-village/protocol'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || new URL(request.url).origin !== origin || !request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'รับคำสั่งจากหน้าเว็บเดียวกันเท่านั้น' }, { status: 403 })
  }
  const village = globalThis.__agentVillage
  if (!village) return Response.json({ error: 'กรุณาเริ่มเว็บด้วย npm run dev เพื่อเปิด WebSocket' }, { status: 503 })
  const result = village.startRun()
  return Response.json(result.accepted ? result : { error: 'Coder กำลังทำภารกิจอยู่' }, { status: result.accepted ? 202 : 409, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const village = globalThis.__agentVillage
  if (!village) return Response.json({ error: 'WebSocket server ไม่พร้อม' }, { status: 503 })
  return Response.json(village.snapshot(), { headers: { 'Cache-Control': 'no-store' } })
}
