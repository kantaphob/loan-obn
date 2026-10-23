import { getDatabaseUrl } from '../lib/database-config'
import { syncRecordFiles } from '../lib/record-files.mjs'
console.log(syncRecordFiles(getDatabaseUrl()))
