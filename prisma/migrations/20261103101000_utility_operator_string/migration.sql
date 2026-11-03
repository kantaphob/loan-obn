PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UtilityBill" (
"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "operatorId" TEXT NOT NULL, "kind" TEXT NOT NULL, "meter" TEXT NOT NULL, "location" TEXT NOT NULL, "period" TEXT NOT NULL, "previousReading" REAL NOT NULL, "currentReading" REAL NOT NULL, "amountSatang" INTEGER NOT NULL, "invoice" TEXT NOT NULL DEFAULT '', "note" TEXT NOT NULL DEFAULT '');
INSERT INTO "new_UtilityBill" SELECT * FROM "UtilityBill";
DROP TABLE "UtilityBill";
ALTER TABLE "new_UtilityBill" RENAME TO "UtilityBill";
CREATE UNIQUE INDEX "UtilityBill_operatorId_kind_meter_period_key" ON "UtilityBill"("operatorId", "kind", "meter", "period");
PRAGMA foreign_keys=ON;
