ALTER TABLE "loan_contract" ADD COLUMN "legacySourceCode" TEXT;
ALTER TABLE "loan_contract" ADD COLUMN "legacyReceivedSatang" REAL NOT NULL DEFAULT 0;
ALTER TABLE "loan_contract" ADD COLUMN "legacyDetails" TEXT;

CREATE UNIQUE INDEX "loan_contract_legacySourceCode_key" ON "loan_contract"("legacySourceCode");
