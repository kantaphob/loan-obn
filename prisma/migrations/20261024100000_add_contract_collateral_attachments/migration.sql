CREATE TABLE "contract_collateral_attachment" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "contractId" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileData" BLOB NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "originalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "originalLocation" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_collateral_attachment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "contract_collateral_attachment_contractId_createdAt_idx" ON "contract_collateral_attachment"("contractId", "createdAt");
