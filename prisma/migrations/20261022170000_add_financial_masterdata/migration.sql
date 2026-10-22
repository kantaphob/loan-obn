CREATE TABLE "financial_category" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "group" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "financial_category_group_sortOrder_idx" ON "financial_category"("group", "sortOrder");

CREATE TABLE "risk_rating" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "isBlacklist" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX "risk_rating_score_idx" ON "risk_rating"("score");

CREATE TABLE "payment_channel" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "bank" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX "bank_sortOrder_idx" ON "bank"("sortOrder");
