CREATE TABLE "UtilityHome" (
 "id" SERIAL PRIMARY KEY,
 "operatorId" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "address" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "UtilityHome_operatorId_name_key" ON "UtilityHome"("operatorId", "name");
INSERT INTO "UtilityHome" ("operatorId", "name", "address") SELECT DISTINCT "operatorId", "location", "location" FROM "UtilityBill";
INSERT INTO "UtilityHome" ("operatorId", "name", "address") SELECT DISTINCT "operatorId", 'บ้านหลังที่ 2', '' FROM "UtilityBill" WHERE "operatorId" NOT IN (SELECT "operatorId" FROM "UtilityHome" WHERE "name" = 'บ้านหลังที่ 2');
ALTER TABLE "UtilityBill" ADD COLUMN "homeId" INTEGER;
UPDATE "UtilityBill" SET "homeId" = (SELECT "id" FROM "UtilityHome" WHERE "UtilityHome"."operatorId" = "UtilityBill"."operatorId" AND "UtilityHome"."address" = "UtilityBill"."location" LIMIT 1);
DROP INDEX "UtilityBill_operatorId_kind_meter_period_key";
ALTER TABLE "UtilityBill" ALTER COLUMN "homeId" SET NOT NULL;
ALTER TABLE "UtilityBill" ADD CONSTRAINT "UtilityBill_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "UtilityHome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "UtilityBill_operatorId_homeId_kind_meter_period_key" ON "UtilityBill"("operatorId", "homeId", "kind", "meter", "period");
