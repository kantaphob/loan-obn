CREATE TABLE "trade_receivable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestKey" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "amountSatang" REAL NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "trade_receivable_requestKey_key" ON "trade_receivable"("requestKey");
CREATE INDEX "trade_receivable_dueDate_idx" ON "trade_receivable"("dueDate");
CREATE INDEX "trade_receivable_customerName_occurredOn_idx" ON "trade_receivable"("customerName", "occurredOn");
ALTER TABLE "ledger_entry" ADD COLUMN "receivableId" INTEGER REFERENCES "trade_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ledger_entry_receivableId_voidedAt_idx" ON "ledger_entry"("receivableId", "voidedAt");

