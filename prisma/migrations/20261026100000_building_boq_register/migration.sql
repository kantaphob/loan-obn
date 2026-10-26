CREATE TABLE "building_boq_item" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'construction',
    "name" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "materialRateSatang" BIGINT NOT NULL DEFAULT 0,
    "materialTotalSatang" BIGINT,
    "laborRateSatang" BIGINT,
    "laborSatang" BIGINT NOT NULL DEFAULT 0,
    "boqTotalSatang" BIGINT,
    "paidSatang" BIGINT NOT NULL DEFAULT 0,
    "vendor" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "ledgerEntryId" INTEGER,
    "room" TEXT,
    "replacesId" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "building_boq_item_pkey" PRIMARY KEY ("operatorId", "assetId", "id"),
    CONSTRAINT "building_boq_item_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "building_boq_item_operatorId_assetId_scope_cancelled_idx" ON "building_boq_item"("operatorId", "assetId", "scope", "cancelled");
CREATE INDEX "building_boq_item_operatorId_ledgerEntryId_idx" ON "building_boq_item"("operatorId", "ledgerEntryId");
