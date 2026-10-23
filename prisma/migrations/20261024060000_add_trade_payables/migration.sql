CREATE TABLE "trade_payable" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "requestKey" TEXT NOT NULL,
 "supplier" TEXT NOT NULL,
 "invoiceNumber" TEXT NOT NULL,
 "description" TEXT NOT NULL,
 "amountSatang" REAL NOT NULL,
 "invoiceDate" TEXT NOT NULL,
 "dueDate" TEXT NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "trade_payable_requestKey_key" ON "trade_payable"("requestKey");
CREATE UNIQUE INDEX "trade_payable_supplier_invoiceNumber_key" ON "trade_payable"("supplier", "invoiceNumber");
CREATE INDEX "trade_payable_dueDate_idx" ON "trade_payable"("dueDate");
ALTER TABLE "ledger_entry" ADD COLUMN "payableId" INTEGER REFERENCES "trade_payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
