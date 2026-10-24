import Database from 'better-sqlite3'
import path from 'node:path'

async function main() {
  process.chdir(process.argv[2])
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'fixture.db')}`
  const db = new Database(path.join(process.cwd(), 'fixture.db'))
  db.exec("CREATE TABLE committed_record (value TEXT); INSERT INTO committed_record VALUES ('committed')")
  db.close()
  // Import after changing cwd: backup and record-file roots stay inside the fixture.
  const { afterDatabaseCommit } = await import('../lib/after-database-commit')
  await afterDatabaseCommit()
}
void main()
