-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_borrower" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provinceId" INTEGER,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "borrower_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "province" ("province_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_borrower" ("approvedLimit", "bankAccount", "createdAt", "durationMonths", "facebook", "firstName", "id", "instagram", "lastName", "line", "nationalId", "nickname", "paymentChannelCode", "phone", "referrer", "registeredAt", "riskRatingCode", "status", "updatedAt", "usedLimit", "workplace") SELECT "approvedLimit", "bankAccount", "createdAt", "durationMonths", "facebook", "firstName", "id", "instagram", "lastName", "line", "nationalId", "nickname", "paymentChannelCode", "phone", "referrer", "registeredAt", "riskRatingCode", "status", "updatedAt", "usedLimit", "workplace" FROM "borrower";
DROP TABLE "borrower";
ALTER TABLE "new_borrower" RENAME TO "borrower";
CREATE UNIQUE INDEX "borrower_nationalId_key" ON "borrower"("nationalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

