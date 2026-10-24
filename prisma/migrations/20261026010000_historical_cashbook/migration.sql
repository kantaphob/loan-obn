CREATE TABLE "historical_cash_entry" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "requestKey" TEXT NOT NULL,
 "accountCode" TEXT NOT NULL,
 "occurredOn" TEXT NOT NULL,
 "direction" TEXT NOT NULL CHECK ("direction" IN ('IN','OUT')),
 "amountSatang" REAL NOT NULL CHECK ("amountSatang">0 AND "amountSatang"=CAST("amountSatang" AS INTEGER)),
 "categoryCode" TEXT NOT NULL,
 "channelCode" TEXT NOT NULL,
 "sourceChannel" TEXT NOT NULL,
 "company" TEXT NOT NULL,
 "description" TEXT NOT NULL,
 "sourceFile" TEXT NOT NULL,
 "sourceHash" TEXT NOT NULL,
 "sourceRow" INTEGER NOT NULL,
 "sourceJson" TEXT NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("categoryCode") REFERENCES "financial_category"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("channelCode") REFERENCES "payment_channel"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "historical_cash_entry_requestKey_key" ON "historical_cash_entry"("requestKey");
CREATE INDEX "historical_cash_entry_accountCode_occurredOn_idx" ON "historical_cash_entry"("accountCode","occurredOn");
