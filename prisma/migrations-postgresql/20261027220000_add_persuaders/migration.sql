CREATE TABLE "persuader" (
 "id" SERIAL NOT NULL PRIMARY KEY,
 "name" TEXT NOT NULL, "phone" TEXT NOT NULL DEFAULT '',
 "bankCode" TEXT NOT NULL DEFAULT '', "bankAccount" TEXT NOT NULL DEFAULT '',
 "bankAccountName" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '',
 "isActive" BOOLEAN NOT NULL DEFAULT true, "borrowerId" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "persuader_borrowerId_key" ON "persuader"("borrowerId");
