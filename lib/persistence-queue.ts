/** Coalesce committed changes; writes during a running snapshot get a later pass. */
export function createPersistenceQueue(work: () => Promise<void>, delayMs = 1000, retryMs = 30_000, report: (error: unknown) => void = console.error) {
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  function arm(delay: number) {
    if (timer || running || !dirty) return
    timer = setTimeout(() => { timer = undefined; void flush() }, delay)
    timer.unref?.()
  }
  function request() { dirty = true; arm(delayMs) }
  async function flush(): Promise<void> {
    if (running) { await running; if (dirty) await flush(); return }
    if (timer) { clearTimeout(timer); timer = undefined }
    if (!dirty) return
    dirty = false
    let failed = false
    running = Promise.resolve().then(work).catch(error => { dirty = true; failed = true; report(error) })
    await running
    running = undefined
    arm(failed ? retryMs : delayMs)
  }
  return { request, flush }
}
