CREATE TABLE "UtilityBill" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "operatorId" INTEGER NOT NULL,
 "kind" TEXT NOT NULL,
 "meter" TEXT NOT NULL,
 "location" TEXT NOT NULL,
 "period" TEXT NOT NULL,
 "previousReading" REAL NOT NULL,
 "currentReading" REAL NOT NULL,
 "amountSatang" INTEGER NOT NULL,
 "invoice" TEXT NOT NULL DEFAULT '',
 "note" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "UtilityBill_operatorId_kind_meter_period_key" ON "UtilityBill"("operatorId", "kind", "meter", "period");
