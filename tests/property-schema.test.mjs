import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'

test('Property migration isolates workspaces and enforces one property per asset', () => {
  const db = new Database(':memory:')
  try {
    db.pragma('foreign_keys = ON')
    db.exec('CREATE TABLE asset_category (code TEXT PRIMARY KEY); CREATE TABLE asset_workspace_state (operatorId TEXT PRIMARY KEY);')
    for (const migration of ['20261026050000_land_register', '20261026060000_property_register']) db.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'))
    db.exec("INSERT INTO asset_workspace_state VALUES ('one'), ('two'); INSERT INTO asset(operatorId,id,code,name,kind,updatedAt) VALUES ('one','a','LAND-001','Land','house',CURRENT_TIMESTAMP);")
    db.exec("INSERT INTO property(operatorId,id,code,name,updatedAt) VALUES ('one','p','PROP-001','Site',CURRENT_TIMESTAMP),('one','q','PROP-002','Other site',CURRENT_TIMESTAMP),('two','r','PROP-001','Other workspace',CURRENT_TIMESTAMP);")
    db.exec("INSERT INTO property_asset(operatorId,propertyId,assetId) VALUES ('one','p','a')")
    assert.throws(() => db.exec("INSERT INTO property_asset(operatorId,propertyId,assetId) VALUES ('one','q','a')"), /UNIQUE/)
    assert.throws(() => db.exec("INSERT INTO property_asset(operatorId,propertyId,assetId) VALUES ('two','r','a')"), /FOREIGN KEY/)
    assert.throws(() => db.exec("UPDATE property SET latitude=91"), /CHECK/)
    assert.throws(() => db.exec("UPDATE property SET type='INVALID'"), /CHECK/)
    assert.throws(() => db.exec("DELETE FROM property WHERE id='p'"), /FOREIGN KEY/)
    assert.throws(() => db.exec("DELETE FROM asset WHERE id='a'"), /FOREIGN KEY/)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM property_asset').get().n, 1)
    const fields = db.prepare('PRAGMA table_info(property)').all().map(field => field.name)
    assert.ok(!fields.includes('purchasePrice') && !fields.includes('cost') && !fields.includes('valuation'))
  } finally { db.close() }
})
