CREATE TABLE "land_improvement" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mobility" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budgetSatang" BIGINT NOT NULL DEFAULT 0,
    "actualCostSatang" BIGINT NOT NULL DEFAULT 0,
    "detailsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "land_improvement_pkey" PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_improvement_land_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "land_improvement_operatorId_landId_category_status_idx" ON "land_improvement"("operatorId", "landId", "category", "status");
