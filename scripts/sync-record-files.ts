import { getDatabaseUrl } from '../lib/database-config'
import { syncRecordFiles } from '../lib/record-files.mjs'
syncRecordFiles(getDatabaseUrl()).then(console.log).catch(error => { console.error(error); process.exitCode = 1 })
