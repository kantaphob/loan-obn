-- CreateTable
CREATE TABLE "loan_contract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestKey" TEXT NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "lenderId" INTEGER NOT NULL,
    "borrowerCode" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "documentChoice" TEXT NOT NULL,
    "signingMethod" TEXT,
    "documentPackage" TEXT,
    "interestMethod" TEXT NOT NULL,
    "interestRateCode" TEXT,
    "interestPercent" REAL NOT NULL,
    "principalSatang" REAL NOT NULL,
    "interestSatang" REAL NOT NULL,
    "netSatang" REAL NOT NULL,
    "repaymentSatang" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING_PAYMENT',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "loan_contract_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "loan_contract_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_contract_requestKey_key" ON "loan_contract"("requestKey");

-- CreateIndex
CREATE INDEX "loan_contract_status_createdAt_idx" ON "loan_contract"("status", "createdAt");

