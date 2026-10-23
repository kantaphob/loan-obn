-- CreateTable
CREATE TABLE "lender" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nickname" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "nationalId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "workplace" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "provinceId" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'FUNDER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "bankCode" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "line" TEXT NOT NULL DEFAULT '',
    "facebook" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "lender_nationalId_key" ON "lender"("nationalId");

-- CreateIndex
CREATE INDEX "lender_role_status_idx" ON "lender"("role", "status");

