CREATE TABLE "ledger_revision" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "entryId" INTEGER NOT NULL,
 "beforeJson" TEXT NOT NULL,
 "afterJson" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("entryId") REFERENCES "ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ledger_revision_entryId_createdAt_idx" ON "ledger_revision"("entryId", "createdAt");
