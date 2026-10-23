CREATE TABLE "interest_rate" (
  "code" TEXT NOT NULL PRIMARY KEY,
  "percent" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "interest_rate_percent_key" ON "interest_rate"("percent");
CREATE TABLE "loan_status" (
  "code" TEXT NOT NULL PRIMARY KEY,
  "nameTh" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);
