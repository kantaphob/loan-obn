CREATE TABLE "asset_category" (
  "code" TEXT NOT NULL PRIMARY KEY,
  "nameTh" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "parentCode" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "asset_category_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "asset_category" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "asset_category_parentCode_sortOrder_idx" ON "asset_category"("parentCode", "sortOrder");
