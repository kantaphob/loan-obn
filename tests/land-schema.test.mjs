import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'

test('land migration enforces area, ownership, money and workspace relationships', () => {
  const db = new Database(':memory:')
  try {
    db.pragma('foreign_keys = ON')
    db.exec('CREATE TABLE asset_category (code TEXT PRIMARY KEY); CREATE TABLE asset_workspace_state (operatorId TEXT PRIMARY KEY);')
    db.exec(readFileSync(new URL('../prisma/migrations/20261026050000_land_register/migration.sql', import.meta.url), 'utf8'))
    db.exec("INSERT INTO asset_workspace_state VALUES ('one'), ('two'); INSERT INTO asset_category VALUES ('LAND');")
    db.exec("INSERT INTO asset(operatorId,id,code,name,kind,categoryCode,updatedAt) VALUES ('one','land','LAND-001','Land','house','LAND',CURRENT_TIMESTAMP);")
    db.exec("INSERT INTO land(operatorId,assetId,rai,ngan,squareWah) VALUES ('one','land',1,2,35.5);")
    assert.throws(() => db.exec("UPDATE land SET ngan=4"), /CHECK/)
    assert.throws(() => db.exec("UPDATE land SET squareWah=100"), /CHECK/)
    assert.throws(() => db.exec("UPDATE land SET latitude=91"), /CHECK/)
    assert.throws(() => db.exec("INSERT INTO land(operatorId,assetId) VALUES ('two','land')"), /FOREIGN KEY/)
    db.exec("INSERT INTO asset_party(operatorId,id,name) VALUES ('one','owner','Owner'),('two','other','Other');")
    assert.throws(() => db.exec("INSERT INTO land_ownership(operatorId,id,landId,ownerId,ownershipPercent,validFrom) VALUES ('one','own','land','other',50,'2026-01-01')"), /FOREIGN KEY/)
    assert.throws(() => db.exec("INSERT INTO land_ownership(operatorId,id,landId,ownerId,ownershipPercent,validFrom) VALUES ('one','own','land','owner',101,'2026-01-01')"), /CHECK/)
    assert.throws(() => db.exec("INSERT INTO asset_transaction(operatorId,id,assetId,transactionType,amountSatang) VALUES ('one','price','land','PURCHASE',-1)"), /CHECK/)
    assert.throws(() => db.exec("DELETE FROM asset WHERE id='land'"), /FOREIGN KEY/)
    assert.equal(db.prepare('SELECT ngan FROM land').get().ngan, 2)
  } finally { db.close() }
})
