ALTER TABLE "trade_receivable" ADD COLUMN "borrowerId" INTEGER;
CREATE INDEX "trade_receivable_borrowerId_idx" ON "trade_receivable"("borrowerId");
ALTER TABLE "trade_receivable" ADD CONSTRAINT "trade_receivable_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
INSERT INTO "financial_category" ("code", "nameTh", "nameEn", "group", "direction", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES ('TRADE_RECEIVABLE_PAYMENT', 'รับชำระลูกหนี้ค้างรับ', 'Trade receivable payment', 'INCOME', 'IN', 74, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
