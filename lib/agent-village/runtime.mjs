import { randomUUID } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

export const AGENT_STATES = ['idle', 'thinking', 'working', 'tool_calling', 'handoff', 'success', 'error']
const requiredFiles = ['app/page.tsx', 'app/dashboard/contracts/page.tsx', 'app/dashboard/accounting/page.tsx', 'app/dashboard/ledger/page.tsx', 'app/dashboard/capital/page.tsx', 'app/dashboard/repayments/page.tsx', 'app/thing/property/page.tsx', 'app/thing/property/boq/page.tsx', 'app/dashboard/analytics/page.tsx', 'lib/pending-contract-review.ts', 'lib/closing-preparation.ts']

export function runTypeCheck(root, onSpawn) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false', '--pretty', 'false'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    let output = '', timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM') }, 90_000)
    const append = chunk => { output = (output + chunk.toString()).slice(-8000) }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.once('spawn', onSpawn)
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', code => { clearTimeout(timer); resolve({ passed: code === 0 && !timedOut, exitCode: code, timedOut, diagnostics: output.trim().slice(0, 4000) }) })
  })
}

// In-memory lifecycle is owned by server.mjs, not by a request or browser tab.
// Dependencies can be replaced in tests; clients cannot choose commands or paths.
export function createAgentVillage({ root, check = runTypeCheck, clock = () => new Date().toISOString(), saveReport } = {}) {
  let sequence = 0, active = false
  let current = { agentId: 'coder', state: 'idle', task: 'รอรับภารกิจตรวจโปรเจกต์', taskId: null, station: 'tea', at: clock() }
  let report = null
  const history = [], listeners = new Set()
  const sessionId = randomUUID()
  const persist = saveReport ?? (async result => {
    const directory = path.join(root, 'private/agent-village/reports')
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, `${result.taskId}.json`), JSON.stringify(result, null, 2), { mode: 0o600 })
  })
  function emit(state, task, station, extra = {}) {
    current = { agentId: 'coder', state, task, taskId: current.taskId, station, at: clock() }
    const event = { type: 'agent.event', sessionId, sequence: ++sequence, ...current, ...extra }
    history.push(event)
    if (history.length > 80) history.shift()
    for (const listener of listeners) { try { listener(event) } catch { /* A disconnected subscriber cannot fail the job. */ } }
    return event
  }
  function snapshot() { return { type: 'agent.snapshot', sessionId, sequence, current: { ...current }, active, report, history: [...history] } }
  async function execute(taskId) {
    const startedAt = clock()
    try {
      emit('thinking', 'อ่านโครงสร้างและวางแผนตรวจโปรเจกต์', 'planning')
      const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
      const files = await Promise.all(requiredFiles.map(async file => {
        try { const source = await readFile(path.join(root, file), 'utf8'); return { file, found: true, bytes: Buffer.byteLength(source) } }
        catch (error) { if (error.code === 'ENOENT') return { file, found: false, bytes: 0 }; throw error }
      }))
      emit('tool_calling', 'เรียก TypeScript ตรวจโค้ดจริงแบบไม่แก้ไฟล์', 'tools', { tool: 'typescript.check' })
      const typeCheck = await check(root, () => emit('working', 'กำลังตรวจ TypeScript ของโปรเจกต์', 'desk', { tool: 'typescript.check' }))
      emit('handoff', 'ส่งผลตรวจให้ตัวตรวจรายงาน', 'review', { targetAgentId: 'reviewer' })
      const passed = typeCheck.passed && files.every(file => file.found)
      const result = { taskId, startedAt, finishedAt: clock(), project: String(manifest.name ?? 'loan-obn'), passed, files, typeCheck, summary: passed ? `พบไฟล์งานครบ ${files.length} จุด และตรวจ TypeScript ผ่าน` : `ตรวจพบรายการที่ต้องแก้ไข · ไฟล์ครบ ${files.filter(file => file.found).length}/${files.length} · TypeScript ${typeCheck.passed ? 'ผ่าน' : 'ไม่ผ่าน'}` }
      await persist(result)
      report = result
      active = false
      emit(passed ? 'success' : 'error', result.summary, 'review', { resultAvailable: true })
    } catch {
      active = false
      emit('error', 'ตรวจโปรเจกต์ไม่สำเร็จ กรุณาตรวจเซิร์ฟเวอร์แล้วลองใหม่', 'desk')
    }
  }
  return {
    snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    startRun() {
      if (active) return { accepted: false, snapshot: snapshot() }
      active = true
      report = null
      const taskId = randomUUID()
      current = { ...current, taskId }
      // Defer until the caller has its task id. This is not an animation timer.
      queueMicrotask(() => { void execute(taskId) })
      return { accepted: true, taskId }
    },
  }
}
