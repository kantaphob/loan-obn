ALTER TABLE "loan_contract" ADD COLUMN "persuaderId" INTEGER REFERENCES "persuader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_contract" ADD COLUMN "persuaderNameSnapshot" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "persuaderShareBase" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "persuaderShareBasisPoints" INTEGER;
ALTER TABLE "loan_contract" ADD COLUMN "persuaderShareSatang" REAL;
CREATE INDEX "loan_contract_persuaderId_createdAt_idx" ON "loan_contract"("persuaderId", "createdAt");
