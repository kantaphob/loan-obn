CREATE TABLE "payroll_record" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "month" TEXT NOT NULL,
  "employer" TEXT NOT NULL,
  "amountsJson" TEXT NOT NULL,
  "grossSatang" REAL NOT NULL,
  "deductionSatang" REAL NOT NULL,
  "netSatang" REAL NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "ledgerEntryId" INTEGER REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "historicalEntryId" INTEGER REFERENCES "historical_cash_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "payroll_receipt_one_source" CHECK ("ledgerEntryId" IS NULL OR "historicalEntryId" IS NULL),
  CONSTRAINT "payroll_amounts_valid" CHECK ("grossSatang" > 0 AND "deductionSatang" >= 0 AND "netSatang" = "grossSatang" - "deductionSatang" AND "netSatang" >= 0)
);
CREATE UNIQUE INDEX "payroll_record_month_employer_key" ON "payroll_record"("month", "employer");
CREATE UNIQUE INDEX "payroll_record_ledgerEntryId_key" ON "payroll_record"("ledgerEntryId");
CREATE UNIQUE INDEX "payroll_record_historicalEntryId_key" ON "payroll_record"("historicalEntryId");
CREATE INDEX "payroll_record_month_idx" ON "payroll_record"("month");
