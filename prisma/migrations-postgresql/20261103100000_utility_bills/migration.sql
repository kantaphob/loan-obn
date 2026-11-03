CREATE TABLE "UtilityBill" (
 "id" SERIAL PRIMARY KEY,
 "operatorId" INTEGER NOT NULL,
 "kind" TEXT NOT NULL,
 "meter" TEXT NOT NULL,
 "location" TEXT NOT NULL,
 "period" TEXT NOT NULL,
 "previousReading" DOUBLE PRECISION NOT NULL,
 "currentReading" DOUBLE PRECISION NOT NULL,
 "amountSatang" INTEGER NOT NULL,
 "invoice" TEXT NOT NULL DEFAULT '',
 "note" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "UtilityBill_operatorId_kind_meter_period_key" ON "UtilityBill"("operatorId", "kind", "meter", "period");
