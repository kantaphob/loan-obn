ALTER TABLE "land_improvement" RENAME TO "land_development";
DROP INDEX IF EXISTS "land_improvement_operatorId_landId_category_status_idx";
ALTER TABLE "land_development" ADD COLUMN "treatment" TEXT NOT NULL DEFAULT 'CAPITAL';
ALTER TABLE "land_development" ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'LUMP_SUM';
ALTER TABLE "land_development" ADD COLUMN "recognizedAssetValueSatang" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "land_development" ADD COLUMN "resultingAssetId" TEXT;
CREATE INDEX "land_development_operatorId_landId_category_status_idx" ON "land_development"("operatorId", "landId", "category", "status");

CREATE TABLE "land_development_cost" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "ledgerEntryId" INTEGER NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "paidOn" DATETIME NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "land_development_cost_pkey" PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_development_cost_development_fkey" FOREIGN KEY ("operatorId", "developmentId") REFERENCES "land_development" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "land_development_cost_ledger_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "land_development_cost_ledgerEntryId_key" ON "land_development_cost"("ledgerEntryId");
CREATE INDEX "land_development_cost_operatorId_developmentId_paidOn_idx" ON "land_development_cost"("operatorId", "developmentId", "paidOn");
