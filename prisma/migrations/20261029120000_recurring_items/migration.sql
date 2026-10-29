CREATE TABLE "recurring_item" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('IN', 'OUT')),
  "amountSatang" REAL NOT NULL CHECK ("amountSatang" > 0),
  "frequency" TEXT NOT NULL CHECK ("frequency" IN ('MONTHLY', 'YEARLY')),
  "dueDay" INTEGER CHECK ("dueDay" BETWEEN 1 AND 31),
  "dueMonth" INTEGER CHECK ("dueMonth" BETWEEN 1 AND 12),
  "startMonth" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "recurring_item_name_direction_frequency_key" ON "recurring_item"("name", "direction", "frequency");
CREATE TABLE "recurring_payment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "itemId" INTEGER NOT NULL REFERENCES "recurring_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "period" TEXT NOT NULL,
  "expectedSatang" REAL NOT NULL,
  "itemName" TEXT NOT NULL,
  "ledgerEntryId" INTEGER REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "historicalEntryId" INTEGER REFERENCES "historical_cash_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_payment_one_source" CHECK (("ledgerEntryId" IS NOT NULL AND "historicalEntryId" IS NULL) OR ("ledgerEntryId" IS NULL AND "historicalEntryId" IS NOT NULL))
);
CREATE UNIQUE INDEX "recurring_payment_itemId_period_key" ON "recurring_payment"("itemId", "period");
CREATE UNIQUE INDEX "recurring_payment_ledgerEntryId_key" ON "recurring_payment"("ledgerEntryId");
CREATE UNIQUE INDEX "recurring_payment_historicalEntryId_key" ON "recurring_payment"("historicalEntryId");
