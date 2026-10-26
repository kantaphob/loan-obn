ALTER TABLE "ledger_entry" ADD COLUMN "accountScope" TEXT NOT NULL DEFAULT 'GENERAL';
-- Preserve existing lending contract movements and the established lending fund.
-- Future general ledger writes retain GENERAL, even when using capital categories.
UPDATE "ledger_entry" SET "accountScope" = 'LENDING'
WHERE ("contractId" IS NOT NULL AND "kind" IN ('DISBURSEMENT', 'REPAYMENT'))
   OR ("kind" = 'GENERAL' AND "categoryCode" IN ('OPENING_CAPITAL', 'CAPITAL_INCREASE', 'CAPITAL_INJECTION', 'CAPITAL_WITHDRAWAL'));
