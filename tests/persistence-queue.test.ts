import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPersistenceQueue } from '../lib/persistence-queue'

test('requests return before backup completes and coalesce a burst', async () => {
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const queue = createPersistenceQueue(async () => { calls++; await gate })
  for (let i = 0; i < 20; i++) queue.request()
  assert.equal(calls, 0)
  const flushing = queue.flush()
  await Promise.resolve()
  assert.equal(calls, 1)
  release()
  await flushing
  await queue.flush()
  assert.equal(calls, 1)
})

test('commits during a backup trigger a second pass without overlapping', async () => {
  let calls = 0, active = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const queue = createPersistenceQueue(async () => {
    assert.equal(++active, 1)
    if (++calls === 1) await gate
    active--
  })
  queue.request()
  const first = queue.flush()
  await Promise.resolve()
  queue.request(); queue.request()
  release(); await first
  await queue.flush()
  assert.equal(calls, 2)
})

test('failed backup remains pending and can be retried', async () => {
  let attempts = 0, errors = 0
  const queue = createPersistenceQueue(async () => { if (++attempts === 1) throw new Error('disk busy') }, 1000, 30_000, () => { errors++ })
  queue.request()
  await queue.flush()
  assert.equal(errors, 1)
  await queue.flush()
  assert.equal(attempts, 2)
})

test('background timer runs and retries failure without another request', async () => {
  let attempts = 0
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('background retry did not run')), 1000)
    const queue = createPersistenceQueue(async () => {
      if (++attempts === 1) throw new Error('temporary failure')
      clearTimeout(deadline)
      resolve()
    }, 1, 1, () => {})
    queue.request()
  })
  assert.equal(attempts, 2)
})
