import { createAutomaticBackup } from './automatic-backups.mjs'
import { syncRecordFiles } from './record-files.mjs'
import { syncBorrowerSlipFiles } from './borrower-slip-files.mjs'
import { createPersistenceQueue } from './persistence-queue'
import { getDatabaseUrl } from './database-config'

export async function afterDatabaseCommit(databaseUrl?: string) {
  if (process.env.LOAN_DISABLE_SIDE_EFFECTS === '1') return
  const url = databaseUrl ?? getDatabaseUrl()
  let syncError: unknown
  try { await syncRecordFiles(url) } catch (error) { syncError = error }
  try { await syncBorrowerSlipFiles(url) } catch (error) { syncError ??= error }
  await createAutomaticBackup()
  if (syncError) throw syncError
}

// Survive development module reloads; the database is authoritative on restart.
const state = globalThis as unknown as { loanPersistenceQueue?: ReturnType<typeof createPersistenceQueue> }
const queue = state.loanPersistenceQueue ??= createPersistenceQueue(afterDatabaseCommit, 1000, 30_000, error => console.error('Background persistence failed; retry scheduled:', error instanceof Error ? error.message : 'unknown'))
export async function scheduleDatabasePersistence() {
  if (process.env.LOAN_DISABLE_SIDE_EFFECTS !== '1') queue.request()
}
export async function flushDatabasePersistence() { await queue.flush() }
