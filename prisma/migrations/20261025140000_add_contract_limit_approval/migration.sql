ALTER TABLE "loan_contract" ADD COLUMN "limitApprovalRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "loan_contract" ADD COLUMN "limitApprovedAt" DATETIME;
ALTER TABLE "loan_contract" ADD COLUMN "limitApprovedBy" TEXT;
