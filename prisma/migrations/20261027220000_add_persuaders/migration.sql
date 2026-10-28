CREATE TABLE "persuader" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "name" TEXT NOT NULL, "phone" TEXT NOT NULL DEFAULT '',
 "bankCode" TEXT NOT NULL DEFAULT '', "bankAccount" TEXT NOT NULL DEFAULT '',
 "bankAccountName" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '',
 "isActive" BOOLEAN NOT NULL DEFAULT true, "borrowerId" INTEGER,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "persuader_borrowerId_key" ON "persuader"("borrowerId");
