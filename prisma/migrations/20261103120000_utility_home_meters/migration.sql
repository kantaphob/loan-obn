ALTER TABLE "UtilityHome" ADD COLUMN "electricityMeter" TEXT NOT NULL DEFAULT '';
ALTER TABLE "UtilityHome" ADD COLUMN "waterMeter" TEXT NOT NULL DEFAULT '';
UPDATE "UtilityHome" SET "electricityMeter" = COALESCE((SELECT "meter" FROM "UtilityBill" WHERE "homeId" = "UtilityHome"."id" AND "kind" = 'ELECTRICITY' ORDER BY "period" DESC, "id" DESC LIMIT 1), '');
UPDATE "UtilityHome" SET "waterMeter" = COALESCE((SELECT "meter" FROM "UtilityBill" WHERE "homeId" = "UtilityHome"."id" AND "kind" = 'WATER' ORDER BY "period" DESC, "id" DESC LIMIT 1), '');
