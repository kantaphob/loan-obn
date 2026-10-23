CREATE TABLE "contract_document_signature" (
  "contractId" INTEGER NOT NULL,
  "documentStage" TEXT NOT NULL,
  "signer" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "signatureData" TEXT NOT NULL,
  "signedAt" DATETIME NOT NULL,
  "consentAt" DATETIME NOT NULL,
  "capturedBy" TEXT NOT NULL,
  PRIMARY KEY ("contractId", "documentStage", "signer"),
  CONSTRAINT "contract_document_signature_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "loan_contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
