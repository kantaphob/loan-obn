-- AlterTable
ALTER TABLE "borrower" ADD COLUMN "borrowerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "borrower_borrowerId_key" ON "borrower"("borrowerId");


UPDATE "borrower" SET "borrowerId" = printf('BR-%05d', "id") WHERE "borrowerId" IS NULL;
