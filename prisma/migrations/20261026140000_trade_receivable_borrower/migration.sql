ALTER TABLE "trade_receivable" ADD COLUMN "borrowerId" INTEGER REFERENCES "borrower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "trade_receivable_borrowerId_idx" ON "trade_receivable"("borrowerId");
