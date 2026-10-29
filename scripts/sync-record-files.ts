import { getDatabaseUrl } from '../lib/database-config'
import { syncRecordFiles } from '../lib/record-files.mjs'
import { syncBorrowerSlipFiles } from '../lib/borrower-slip-files.mjs'
const databaseUrl = getDatabaseUrl()
Promise.all([syncRecordFiles(databaseUrl), syncBorrowerSlipFiles(databaseUrl)])
  .then(([records, slips]) => console.log({ ...records, slips }))
  .catch(error => { console.error(error); process.exitCode = 1 })
