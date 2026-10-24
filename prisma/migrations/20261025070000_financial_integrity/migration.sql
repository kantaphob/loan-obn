ALTER TABLE "ledger_entry" ADD COLUMN "slipHash" TEXT;
CREATE UNIQUE INDEX "ledger_active_slip_hash" ON "ledger_entry"("slipHash") WHERE "voidedAt" IS NULL AND "slipHash" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_active_bank_reference" ON "ledger_entry"(lower(trim("reference"))) WHERE "voidedAt" IS NULL AND "channelCode" IN ('BANKING', 'PROMPTPAY') AND trim("reference") <> '';
CREATE TABLE "google_sync_job" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "entity" TEXT NOT NULL,
 "entityId" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "version" INTEGER NOT NULL DEFAULT 1,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "lastError" TEXT NOT NULL DEFAULT '',
 "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastAttemptAt" DATETIME,
 "syncedAt" DATETIME,
 "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "google_sync_job_status_nextAttemptAt_idx" ON "google_sync_job"("status", "nextAttemptAt");
