ALTER TABLE "ledger_entry" ADD COLUMN "penaltyWaivedSatang" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ledger_entry" ADD COLUMN "penaltyWaiverReason" TEXT NOT NULL DEFAULT '';
