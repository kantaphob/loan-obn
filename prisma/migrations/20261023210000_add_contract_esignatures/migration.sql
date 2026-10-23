ALTER TABLE "loan_contract" ADD COLUMN "borrowerSignatureData" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "borrowerSignedAt" DATETIME;
ALTER TABLE "loan_contract" ADD COLUMN "borrowerCapturedBy" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "lenderSignatureData" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "lenderSignedAt" DATETIME;
ALTER TABLE "loan_contract" ADD COLUMN "lenderCapturedBy" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "signatureTermsHash" TEXT;
