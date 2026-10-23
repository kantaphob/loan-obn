-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_lender" (
    "titleTh" TEXT NOT NULL DEFAULT '',
    "middleNameTh" TEXT NOT NULL DEFAULT '',
    "titleEn" TEXT NOT NULL DEFAULT '',
    "firstNameEn" TEXT NOT NULL DEFAULT '',
    "middleNameEn" TEXT NOT NULL DEFAULT '',
    "lastNameEn" TEXT NOT NULL DEFAULT '',
    "birthDate" TEXT NOT NULL DEFAULT '',
    "houseNumber" TEXT NOT NULL DEFAULT '',
    "villageNumber" TEXT NOT NULL DEFAULT '',
    "cardIssueDate" TEXT NOT NULL DEFAULT '',
    "cardExpiryDate" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "promptPayNumber" TEXT NOT NULL DEFAULT '',
    "registeredAt" TEXT NOT NULL DEFAULT '',
    "promptPayType" TEXT NOT NULL DEFAULT '',
    "paymentChannelCode" TEXT NOT NULL DEFAULT '',
    "cardData" TEXT,
    "cardReadAt" DATETIME,
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
INSERT INTO "new_lender" ("address", "bankAccount", "bankAccountName", "bankCode", "cardData", "cardReadAt", "createdAt", "facebook", "firstName", "id", "lastName", "line", "nationalId", "nickname", "notes", "phone", "provinceId", "role", "status", "updatedAt", "workplace") SELECT "address", "bankAccount", "bankAccountName", "bankCode", "cardData", "cardReadAt", "createdAt", "facebook", "firstName", "id", "lastName", "line", "nationalId", "nickname", "notes", "phone", "provinceId", "role", "status", "updatedAt", "workplace" FROM "lender";
DROP TABLE "lender";
ALTER TABLE "new_lender" RENAME TO "lender";
CREATE UNIQUE INDEX "lender_nationalId_key" ON "lender"("nationalId");
CREATE INDEX "lender_role_status_idx" ON "lender"("role", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

