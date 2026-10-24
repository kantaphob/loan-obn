ALTER TABLE "loan_contract" ADD COLUMN "reviewVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "contract_revision" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "contractId" INTEGER NOT NULL,
 "kind" TEXT NOT NULL,
 "beforeJson" TEXT NOT NULL,
 "afterJson" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("contractId") REFERENCES "loan_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "contract_revision_contractId_createdAt_idx" ON "contract_revision"("contractId", "createdAt");
