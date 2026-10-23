CREATE TABLE "ledger_entry" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "requestKey" TEXT NOT NULL,
 "contractId" INTEGER,
 "kind" TEXT NOT NULL,
 "direction" TEXT NOT NULL,
 "categoryCode" TEXT NOT NULL,
 "categoryName" TEXT NOT NULL,
 "amountSatang" REAL NOT NULL,
 "occurredOn" TEXT NOT NULL,
 "channelCode" TEXT NOT NULL,
 "channelName" TEXT NOT NULL,
 "reference" TEXT NOT NULL DEFAULT '',
 "note" TEXT NOT NULL DEFAULT '',
 "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" DATETIME,
 "voidedBy" TEXT,
 "voidReason" TEXT,
 CONSTRAINT "ledger_entry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ledger_positive_amount" CHECK ("amountSatang" > 0 AND "amountSatang" = CAST("amountSatang" AS INTEGER)),
 CONSTRAINT "ledger_direction" CHECK ("direction" IN ('IN','OUT'))
);
CREATE UNIQUE INDEX "ledger_entry_requestKey_key" ON "ledger_entry"("requestKey");
CREATE INDEX "ledger_entry_contractId_voidedAt_idx" ON "ledger_entry"("contractId", "voidedAt");
CREATE INDEX "ledger_entry_occurredOn_idx" ON "ledger_entry"("occurredOn");
