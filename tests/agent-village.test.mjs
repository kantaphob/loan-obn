import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAgentVillage } from '../lib/agent-village/runtime.mjs'

function waitForTerminal(village) {
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('Job did not finish')), 3000)
    const unsubscribe = village.subscribe(event => {
      if (event.state === 'success' || event.state === 'error') { clearTimeout(timer); unsubscribe(); resolve(event) }
    })
  })
}

test('a real file inspection emits an ordered lifecycle, rejects concurrent work and preserves a reconnect snapshot', async () => {
  let finishCheck
  const reports = []
  const village = createAgentVillage({ root: process.cwd(), check: async (_root,onSpawn) => { onSpawn(); return new Promise(resolve => { finishCheck = resolve }) }, saveReport: async report => reports.push(report) })
  const observed = [], unsubscribe = village.subscribe(event => observed.push(event))
  const initial = village.snapshot()
  assert.equal(initial.current.state,'idle')
  assert.equal(initial.active,false)
  const terminal = waitForTerminal(village)
  const run = village.startRun()
  assert.equal(run.accepted,true)
  assert.equal(village.startRun().accepted,false)
  // Resolve file IO naturally; no artificial lifecycle delays in production.
  while (!finishCheck) await new Promise(resolve => setImmediate(resolve))
  const reconnect = village.snapshot()
  assert.equal(reconnect.current.state,'working')
  assert.equal(reconnect.active,true)
  assert.equal(reconnect.current.taskId,run.taskId)
  finishCheck({ passed:true, exitCode:0, timedOut:false, diagnostics:'' })
  await terminal
  unsubscribe()
  assert.deepEqual(observed.map(e => e.state),['thinking','tool_calling','working','handoff','success'])
  assert.deepEqual(observed.map(e => e.sequence),[1,2,3,4,5])
  assert.ok(observed.every(e => e.taskId === run.taskId && e.sessionId === initial.sessionId))
  assert.equal(reports.length,1)
  assert.equal(reports[0].files.length,11)
  assert.ok(reports[0].files.every(file => file.found && file.bytes > 0))
  assert.equal(village.snapshot().report.taskId,run.taskId)
  assert.equal(village.snapshot().active,false)
  // A browser reconnect observes the final result, not a made-up idle state.
  assert.equal(village.snapshot().current.state,'success')
  assert.equal(initial.history.length,0)
})

test('type-check failure is an error with actual diagnostics, and permits a subsequent run', async () => {
  const village = createAgentVillage({ root:process.cwd(), check:async (_root,onSpawn) => {onSpawn();return {passed:false,exitCode:2,timedOut:false,diagnostics:'fixture.ts: type mismatch'}}, saveReport:async () => {} })
  let terminal = waitForTerminal(village)
  village.startRun()
  assert.equal((await terminal).state,'error')
  assert.equal(village.snapshot().report.passed,false)
  assert.match(village.snapshot().report.typeCheck.diagnostics,/type mismatch/)
  terminal = waitForTerminal(village)
  assert.equal(village.startRun().accepted,true)
  await terminal
  assert.equal(village.snapshot().sequence,10)
})

test('a missing project or failed persistence never emits success', async () => {
  for (const options of [
    {root:'/nonexistent/agent-village-test'},
    {root:process.cwd(), check:async () => ({passed:true,exitCode:0,timedOut:false,diagnostics:''}), saveReport:async () => {throw new Error('disk full')}},
  ]) {
    const village = createAgentVillage(options)
    const terminal = waitForTerminal(village)
    village.startRun()
    assert.equal((await terminal).state,'error')
    assert.equal(village.snapshot().active,false)
    assert.equal(village.snapshot().report,null)
    assert.ok(!village.snapshot().history.some(event => event.state === 'success'))
  }
})
