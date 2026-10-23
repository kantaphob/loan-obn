CREATE TABLE "contract_witness" (
 "contractId" INTEGER NOT NULL,
 "position" INTEGER NOT NULL,
 "name" TEXT NOT NULL,
 "signatureData" TEXT NOT NULL,
 "signedAt" DATETIME NOT NULL,
 "consentAt" DATETIME NOT NULL,
 "capturedBy" TEXT NOT NULL,
 PRIMARY KEY ("contractId", "position"),
 CONSTRAINT "contract_witness_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
