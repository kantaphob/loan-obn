CREATE TABLE "ledger_slip" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "entryId" INTEGER NOT NULL,
 "originalName" TEXT NOT NULL,
 "mimeType" TEXT NOT NULL,
 "fileData" BLOB NOT NULL,
 "sizeBytes" INTEGER NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ledger_slip_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ledger_slip_entryId_key" ON "ledger_slip"("entryId");
