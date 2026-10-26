import Database from 'better-sqlite3'
import { readFileSync, writeFileSync } from 'node:fs'
const source = new Database(process.argv[2] || 'private/database/ProgressSQL.db', { readonly: true, fileMustExist: true })
const destination = 'prisma/migrations-postgresql/20261026140000_postgresql_baseline/migration.sql'
let sql = readFileSync(destination, 'utf8')
sql = sql.replace(/(ALTER TABLE[^;]+FOREIGN KEY[^;]+);/g, '$1 DEFERRABLE INITIALLY IMMEDIATE;')
const names = new Set()
const tables = source.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'").all()
for (const table of tables) for (const column of source.prepare(`PRAGMA table_info("${table.name}")`).all()) names.add(column.name)
const quoteExpression = expression => expression.split(/('(?:[^']|'')*')/g).map((piece, index) => index % 2 ? piece : piece.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, name => names.has(name) ? `"${name}"` : name)).join('').replace(/IS NOT(?! NULL)/g, 'IS DISTINCT FROM')
sql += '\n-- Preserve SQLite application guards when switching providers.\n'
for (const trigger of source.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all()) {
  const match = trigger.sql.match(/^CREATE TRIGGER\s+(\w+)\s+(BEFORE|AFTER)\s+(INSERT|UPDATE(?: OF [\w, ]+)?|DELETE)\s+ON\s+(\w+)\s*(?:WHEN\s+([\s\S]+?)\s*)?BEGIN\s+([\s\S]+)\s+END\s*$/i)
  if (!match) throw new Error(`Unsupported trigger: ${trigger.name}`)
  const [, name, timing, event, table, condition, body] = match
  let statement
  const raise = body.match(/^SELECT RAISE\(ABORT,\s*('(?:[^']|'')*')\);?$/i)
  if (raise) statement = `RAISE EXCEPTION USING MESSAGE = ${raise[1]};`
  else if (/^UPDATE /i.test(body)) statement = quoteExpression(body)
  else throw new Error(`Unsupported trigger body: ${name}`)
  const functionName = `guard_${name}`
  const returnValue = event === 'DELETE' ? 'OLD' : 'NEW'
  sql += `CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n`
  if (condition) sql += `  IF ${quoteExpression(condition)} THEN\n    ${statement}\n  END IF;\n`
  else sql += `  ${statement}\n`
  sql += `  RETURN ${returnValue};\nEND;\n$$;\nCREATE TRIGGER "${name}" ${timing} ${quoteExpression(event)} ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${functionName}"();\n`
}
// Checks in the live schema can be carried over as separate PostgreSQL constraints.
for (const table of tables) {
  const text = table.sql
  let count = 0
  for (const found of text.matchAll(/CHECK\s*\(/gi)) {
    let depth = 1, end = found.index + found[0].length
    const start = end
    for (; end < text.length && depth; end++) { if (text[end] === '(') depth++; if (text[end] === ')') depth-- }
    let expression = text.slice(start, end - 1).replace(/CAST\(([^)]+) AS INTEGER\)/g, 'CAST($1 AS BIGINT)')
    sql += `ALTER TABLE "${table.name}" ADD CONSTRAINT "${table.name}_check_${++count}" CHECK (${expression});\n`
  }
}
sql += `CREATE UNIQUE INDEX "ledger_active_slip_hash" ON "ledger_entry"("slipHash") WHERE "voidedAt" IS NULL AND "slipHash" IS NOT NULL;\nCREATE UNIQUE INDEX "ledger_active_bank_reference" ON "ledger_entry"(lower(trim("reference"))) WHERE "voidedAt" IS NULL AND "channelCode" IN ('BANKING', 'PROMPTPAY') AND trim("reference") <> '';\n`
writeFileSync(destination, sql)
source.close()
console.log('Prepared PostgreSQL baseline with existing checks, triggers and financial uniqueness guards.')
