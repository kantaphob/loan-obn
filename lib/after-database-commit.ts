import { createAutomaticBackup } from './automatic-backups.mjs'
import { syncRecordFiles } from './record-files.mjs'
import { getDatabaseUrl } from './database-config'

export async function afterDatabaseCommit() {
  if (process.env.LOAN_DISABLE_SIDE_EFFECTS === '1') return
  let syncError: unknown
  try { syncRecordFiles(getDatabaseUrl()) } catch (error) { syncError = error }
  await createAutomaticBackup()
  if (syncError) throw syncError
}
