ALTER TABLE "ledger_entry" ADD COLUMN "settlementWaivedSatang" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ledger_entry" ADD COLUMN "settlementWaiverReason" TEXT NOT NULL DEFAULT '';
