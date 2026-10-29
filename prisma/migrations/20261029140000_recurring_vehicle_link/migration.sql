ALTER TABLE "recurring_item" ADD COLUMN "assetOperatorId" TEXT;
ALTER TABLE "recurring_item" ADD COLUMN "assetId" TEXT;
CREATE TRIGGER "recurring_asset_insert" BEFORE INSERT ON "recurring_item"
WHEN (NEW."assetOperatorId" IS NULL) != (NEW."assetId" IS NULL) OR (NEW."assetId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "asset" WHERE "operatorId" = NEW."assetOperatorId" AND "id" = NEW."assetId"))
BEGIN SELECT RAISE(ABORT, 'Invalid recurring asset link'); END;
CREATE TRIGGER "recurring_asset_update" BEFORE UPDATE OF "assetOperatorId", "assetId" ON "recurring_item"
WHEN (NEW."assetOperatorId" IS NULL) != (NEW."assetId" IS NULL) OR (NEW."assetId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "asset" WHERE "operatorId" = NEW."assetOperatorId" AND "id" = NEW."assetId"))
BEGIN SELECT RAISE(ABORT, 'Invalid recurring asset link'); END;
CREATE TRIGGER "recurring_asset_restrict_delete" BEFORE DELETE ON "asset"
WHEN EXISTS (SELECT 1 FROM "recurring_item" WHERE "assetOperatorId" = OLD."operatorId" AND "assetId" = OLD."id")
BEGIN SELECT RAISE(ABORT, 'Asset is linked to recurring items'); END;
