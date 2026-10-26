import { mkdirSync, existsSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import pg from 'pg'

const directory = path.resolve('private/postgres')
mkdirSync(directory, { recursive: true, mode: 0o700 })
const secretFile = path.join(directory, 'local-credentials.json')
if (!existsSync(secretFile)) writeFileSync(secretFile, JSON.stringify({ adminPassword: randomBytes(32).toString('hex'), appPassword: randomBytes(32).toString('hex'), port: 55432 }), { mode: 0o600, flag: 'wx' })
const config = JSON.parse(readFileSync(secretFile, 'utf8'))
const data = path.join(directory, 'data'), socket = path.join(directory, 'socket')
mkdirSync(socket, { recursive: true, mode: 0o700 })
const run = (name, args) => {
  const result = spawnSync(name, args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${name} failed: ${result.stderr || result.stdout}`)
}
const passwordFile = path.join(directory, '.admin-password')
writeFileSync(passwordFile, config.adminPassword, { mode: 0o600 }); chmodSync(passwordFile, 0o600)
if (!existsSync(path.join(data, 'PG_VERSION'))) run('initdb', ['-D', data, '-U', 'loan_obn_admin', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--pwfile', passwordFile])
const status = spawnSync('pg_ctl', ['-D', data, 'status'], { encoding: 'utf8' })
if (status.status !== 0) run('pg_ctl', ['-D', data, '-l', path.join(directory, 'server.log'), '-o', `-p ${config.port} -h 127.0.0.1 -k ${socket}`, 'start'])
const admin = new pg.Client({ host: '127.0.0.1', port: config.port, user: 'loan_obn_admin', password: config.adminPassword, database: 'postgres' })
await admin.connect()
try {
  if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='loan_obn'")).rowCount) await admin.query(`CREATE ROLE loan_obn LOGIN PASSWORD '${config.appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`)
  const name = process.argv[2] ?? 'loan_obn'
  if (!/^loan_obn(?:_[a-z0-9]+)*$/.test(name)) throw new Error('Use an application-owned database name')
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) await admin.query(`CREATE DATABASE "${name}" OWNER loan_obn`)
  const url = `postgresql://loan_obn:${config.appPassword}@127.0.0.1:${config.port}/${name}?schema=public`
  writeFileSync(path.join(directory, 'application.env'), `DATABASE_URL="${url}"\n`, { mode: 0o600 })
  console.log(`Local PostgreSQL ready on 127.0.0.1:${config.port}; database ${name}. Credentials saved privately.`)
} finally { await admin.end() }
