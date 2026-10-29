ALTER TABLE "recurring_item" ADD COLUMN "assetOperatorId" TEXT;
ALTER TABLE "recurring_item" ADD COLUMN "assetId" TEXT;
ALTER TABLE "recurring_item" ADD CONSTRAINT "recurring_item_assetOperatorId_assetId_fkey" FOREIGN KEY ("assetOperatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_item" ADD CONSTRAINT "recurring_item_asset_link_complete" CHECK (("assetOperatorId" IS NULL AND "assetId" IS NULL) OR ("assetOperatorId" IS NOT NULL AND "assetId" IS NOT NULL));
