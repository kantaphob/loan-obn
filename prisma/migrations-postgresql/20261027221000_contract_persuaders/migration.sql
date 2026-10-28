-- AlterTable
ALTER TABLE "loan_contract" ADD COLUMN     "persuaderId" INTEGER,
ADD COLUMN     "persuaderNameSnapshot" TEXT,
ADD COLUMN     "persuaderShareBase" TEXT,
ADD COLUMN     "persuaderShareBasisPoints" INTEGER,
ADD COLUMN     "persuaderShareSatang" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "loan_contract_persuaderId_createdAt_idx" ON "loan_contract"("persuaderId", "createdAt");

-- AddForeignKey
ALTER TABLE "loan_contract" ADD CONSTRAINT "loan_contract_persuaderId_fkey" FOREIGN KEY ("persuaderId") REFERENCES "persuader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

