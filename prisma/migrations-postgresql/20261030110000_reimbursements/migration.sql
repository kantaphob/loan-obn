-- CreateTable
CREATE TABLE "expense_claim" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "claimantId" INTEGER NOT NULL,
    "payerId" INTEGER NOT NULL,
    "spentOn" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "amountSatang" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "pdfData" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "expense_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursement_voucher" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "payerId" INTEGER NOT NULL,
    "payeeId" INTEGER NOT NULL,
    "payerName" TEXT NOT NULL,
    "payeeName" TEXT NOT NULL,
    "paidOn" TEXT NOT NULL,
    "amountSatang" DOUBLE PRECISION NOT NULL,
    "channelName" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdLedger" BOOLEAN NOT NULL DEFAULT false,
    "ledgerEntryId" INTEGER,
    "historicalEntryId" INTEGER,
    "snapshotJson" TEXT NOT NULL,
    "pdfData" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "reimbursement_voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursement_allocation" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "claimId" INTEGER NOT NULL,
    "amountSatang" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "reimbursement_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursement_file" (
    "id" SERIAL NOT NULL,
    "claimId" INTEGER,
    "voucherId" INTEGER,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reimbursement_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursement_event" (
    "id" SERIAL NOT NULL,
    "claimId" INTEGER,
    "voucherId" INTEGER,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reimbursement_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_claim_requestKey_key" ON "expense_claim"("requestKey");

-- CreateIndex
CREATE INDEX "expense_claim_claimantId_payerId_spentOn_idx" ON "expense_claim"("claimantId", "payerId", "spentOn");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_voucher_requestKey_key" ON "reimbursement_voucher"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_voucher_ledgerEntryId_key" ON "reimbursement_voucher"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_voucher_historicalEntryId_key" ON "reimbursement_voucher"("historicalEntryId");

-- CreateIndex
CREATE INDEX "reimbursement_voucher_payeeId_paidOn_idx" ON "reimbursement_voucher"("payeeId", "paidOn");

-- CreateIndex
CREATE INDEX "reimbursement_allocation_claimId_idx" ON "reimbursement_allocation"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_allocation_voucherId_claimId_key" ON "reimbursement_allocation"("voucherId", "claimId");

-- CreateIndex
CREATE INDEX "reimbursement_file_claimId_idx" ON "reimbursement_file"("claimId");

-- CreateIndex
CREATE INDEX "reimbursement_file_voucherId_idx" ON "reimbursement_file"("voucherId");

-- CreateIndex
CREATE INDEX "reimbursement_event_claimId_idx" ON "reimbursement_event"("claimId");

-- CreateIndex
CREATE INDEX "reimbursement_event_voucherId_idx" ON "reimbursement_event"("voucherId");

-- AddForeignKey
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_claimantId_fkey" FOREIGN KEY ("claimantId") REFERENCES "lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_voucher" ADD CONSTRAINT "reimbursement_voucher_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_voucher" ADD CONSTRAINT "reimbursement_voucher_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_voucher" ADD CONSTRAINT "reimbursement_voucher_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_voucher" ADD CONSTRAINT "reimbursement_voucher_historicalEntryId_fkey" FOREIGN KEY ("historicalEntryId") REFERENCES "historical_cash_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_allocation" ADD CONSTRAINT "reimbursement_allocation_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "reimbursement_voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_allocation" ADD CONSTRAINT "reimbursement_allocation_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_file" ADD CONSTRAINT "reimbursement_file_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_file" ADD CONSTRAINT "reimbursement_file_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "reimbursement_voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_event" ADD CONSTRAINT "reimbursement_event_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_event" ADD CONSTRAINT "reimbursement_event_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "reimbursement_voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

