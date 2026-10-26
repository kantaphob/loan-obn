import pg from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
const config = JSON.parse(readFileSync('private/postgres/local-credentials.json','utf8'))
const admin = new pg.Client({ host:'127.0.0.1', port:config.port, user:'loan_obn_admin', password:config.adminPassword, database:'postgres' })
const schema = readdirSync('prisma/migrations-postgresql').filter(name => /^\d/.test(name)).sort().map(name => readFileSync(`prisma/migrations-postgresql/${name}/migration.sql`, 'utf8')).join('\n')
const suites = [
 ['contract',['contracts.test.ts']], ['ledger',['ledger.test.ts']],
 ['integrity',['financial-integrity.test.ts']], ['review',['pending-contract-review.test.ts']],
 ['closing',['account-closing.test.ts','account-closing-actions.test.ts','accounting-workpaper.test.ts','cash-carryforward.test.ts']],
 ['assets',['asset.test.ts','asset-actions.test.ts','property-financials.test.ts']],
]
const run = (args, env) => new Promise(resolve => { const child=spawn(process.execPath,args,{env,stdio:'inherit'});child.on('error',()=>resolve(1));child.on('close',resolve) })
await admin.connect()
try {
 for (const [suite,files] of suites) {
  const name=`loan-${suite}-test-pg-${randomBytes(5).toString('hex')}`
  await admin.query(`CREATE DATABASE "${name}" OWNER loan_obn`)
  const url=`postgresql://loan_obn:${config.appPassword}@127.0.0.1:${config.port}/${name}`
  const client=new pg.Client({connectionString:url}); await client.connect()
  try { await client.query(schema) } finally { await client.end() }
  try {
   const status=await run(['--import','./tests/ledger-register.mjs','--import','tsx','--test',...files.map(file=>'tests/'+file)],{...process.env,DATABASE_URL:url,LOAN_DISABLE_SIDE_EFFECTS:'1',GOOGLE_APPS_SCRIPT_URL:'',GOOGLE_SYNC_TOKEN:'',ASSET_DATA_DIRECTORY:'/tmp/loan-postgres-test-no-legacy'})
   if (status) throw new Error(`PostgreSQL ${suite} tests failed`)
  } finally { await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`) }
 }
} finally { await admin.end() }
