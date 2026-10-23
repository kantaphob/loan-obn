-- CreateTable
CREATE TABLE "borrower" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nickname" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "workplace" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "paymentChannelCode" TEXT NOT NULL DEFAULT '',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMonths" INTEGER NOT NULL DEFAULT 0,
    "facebook" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "line" TEXT NOT NULL DEFAULT '',
    "riskRatingCode" TEXT NOT NULL DEFAULT '',
    "approvedLimit" INTEGER NOT NULL DEFAULT 0,
    "usedLimit" INTEGER NOT NULL DEFAULT 0,
    "referrer" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "borrower_nationalId_key" ON "borrower"("nationalId");

