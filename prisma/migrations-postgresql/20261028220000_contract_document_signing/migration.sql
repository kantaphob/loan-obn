ALTER TABLE "loan_contract" ADD COLUMN "documentCreatedAt" TIMESTAMP(3);
ALTER TABLE "loan_contract" ADD COLUMN "documentCreatedBy" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "printSignedAt" TIMESTAMP(3);
ALTER TABLE "loan_contract" ADD COLUMN "printSignedBy" TEXT;
