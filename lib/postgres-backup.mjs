import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'

export function postgresEnvironment(url) {
  const value = new URL(url)
  return { ...process.env, PGHOST: value.hostname, PGPORT: value.port || '5432', PGUSER: decodeURIComponent(value.username), PGPASSWORD: decodeURIComponent(value.password), PGDATABASE: decodeURIComponent(value.pathname.slice(1)) }
}
export function postgresBinary(name) {
  const directory = process.env.PG_BIN_DIRECTORY || '/opt/homebrew/opt/postgresql@18/bin'
  return existsSync(path.join(directory, name)) ? path.join(directory, name) : name
}
export function runProgram(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'] })
    let error = ''
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} failed (${code}): ${error.replaceAll(env.PGPASSWORD || '___', '[redacted]')}`)))
  })
}

/** A restoreable package contains both a consistent DB snapshot and private files. */
export async function createPostgresArchive(destination, url = process.env.DATABASE_URL) {
  if (!url || !/^postgres(?:ql)?:/.test(url)) throw new Error('PostgreSQL connection required')
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
  const directory = await mkdtemp(path.join(path.dirname(destination), '.postgres-backup-'))
  try {
    const dump = path.join(directory, 'database.dump')
    await runProgram(postgresBinary('pg_dump'), ['--format=custom', '--no-owner', '--no-acl', '--file', dump], postgresEnvironment(url))
    await runProgram(postgresBinary('pg_restore'), ['--list', dump])
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ version: 2, provider: 'postgresql', createdAt: new Date().toISOString(), databaseDump: 'database.dump', files: ['private/', 'uploads/'], omitted: ['generated profile JSON files (regenerate with npm run storage:sync)', 'database server files and credentials'], restore: 'Restore database.dump with pg_restore into an empty database, restore private/ and uploads/ to the project directory, then run npm run storage:sync.' }, null, 2), { mode: 0o600 })
    // Generated profiles are rebuildable from the database. Archive private user
    // attachments directly without copying thousands of generated directories.
    const args = ['--exclude=private/backups', '--exclude=private/database', '--exclude=private/postgres', '--exclude=*-profile.json', '--exclude=private/record-files-index.json', '-cf', destination, '-C', directory, 'database.dump', 'manifest.json', '-C', process.cwd(), 'private']
    if (existsSync('uploads')) args.push('uploads')
    await runProgram('tar', args)
    await chmod(destination, 0o600)
  } finally { await rm(directory, { recursive: true, force: true }) }
}
