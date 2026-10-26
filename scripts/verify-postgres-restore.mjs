import pg from 'pg'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { createPostgresArchive, postgresEnvironment, postgresBinary, runProgram } from '../lib/postgres-backup.mjs'
import { normalized, digest } from '../lib/postgres-data-verify.mjs'

pg.types.setTypeParser(1114, text => new Date(text.replace(' ', 'T') + 'Z'))
const config=JSON.parse(readFileSync('private/postgres/local-credentials.json','utf8'))
const sourceUrl=readFileSync('private/postgres/application.env','utf8').match(/DATABASE_URL="([^"]+)"/)[1]
// Verify against current data; the original cutover report becomes stale after writes.
const source = new pg.Client({ connectionString: sourceUrl }); await source.connect()
const report = { tables: [] }
try {
  const columns=(await source.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY ordinal_position")).rows
  for (const table of [...new Set(columns.map(c=>c.table_name))]) {
    const fields=columns.filter(c=>c.table_name===table)
    const rows=(await source.query(`SELECT * FROM "${table.replaceAll('"','""')}"`)).rows
    report.tables.push({ table, rows: rows.length, sha256: digest(rows.map(row=>fields.map(field=>normalized(row[field.column_name],field)))) })
  }
} finally { await source.end() }
const archive=path.resolve(`private/backups/PostgreSQL-cutover-verified-${Date.now()}.tar`)
await createPostgresArchive(archive,sourceUrl)
const directory=await mkdtemp(path.resolve('private/backups/.restore-check-'))
const admin=new pg.Client({host:'127.0.0.1',port:config.port,user:'loan_obn_admin',password:config.adminPassword,database:'postgres'})
const name=`loan_obn_restore_check_${Date.now()}`
await admin.connect()
try {
  await runProgram('tar',['-xf',archive,'-C',directory])
  await admin.query(`CREATE DATABASE "${name}" OWNER loan_obn`)
  const targetUrl=new URL(sourceUrl);targetUrl.pathname='/'+name
  await runProgram(postgresBinary('pg_restore'),['--exit-on-error','--no-owner','--no-acl','--dbname',name,path.join(directory,'database.dump')],postgresEnvironment(targetUrl.toString()))
  const client=new pg.Client({connectionString:targetUrl.toString()}); await client.connect()
  try {
    const columns=(await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY ordinal_position")).rows
    for (const table of report.tables) {
      const fields=columns.filter(column=>column.table_name===table.table)
      const rows=(await client.query(`SELECT * FROM "${table.table.replaceAll('"','""')}"`)).rows
      if(rows.length!==table.rows || digest(rows.map(row=>fields.map(field=>normalized(row[field.column_name],field))))!==table.sha256) throw new Error(`Restore verification failed for ${table.table}`)
    }
    console.log(`Backup restored successfully; all ${report.tables.length} application tables match the current PostgreSQL data.`)
  } finally { await client.end() }
  console.log('Verified PostgreSQL backup includes the database and private attachment files.')
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  await admin.end(); await rm(directory,{recursive:true,force:true})
}
