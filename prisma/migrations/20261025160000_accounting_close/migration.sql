CREATE TABLE "accounting_close" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "requestKey" TEXT NOT NULL, "startOn" TEXT NOT NULL, "endOn" TEXT NOT NULL,
 "note" TEXT NOT NULL, "balancesJson" TEXT NOT NULL, "journalJson" TEXT NOT NULL,
 "cashSnapshotJson" TEXT NOT NULL, "profitSatang" REAL NOT NULL,
 "createdBy" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "accounting_close_requestKey_key" ON "accounting_close"("requestKey");
CREATE UNIQUE INDEX "accounting_close_endOn_key" ON "accounting_close"("endOn");
CREATE TRIGGER accounting_close_no_update BEFORE UPDATE ON accounting_close BEGIN SELECT RAISE(ABORT, 'Closing journals are immutable'); END;
CREATE TRIGGER accounting_close_no_delete BEFORE DELETE ON accounting_close BEGIN SELECT RAISE(ABORT, 'Closing journals are immutable'); END;
CREATE TRIGGER accounting_close_order BEFORE INSERT ON accounting_close WHEN NEW.startOn > NEW.endOn OR EXISTS (SELECT 1 FROM accounting_close WHERE endOn >= NEW.startOn) BEGIN SELECT RAISE(ABORT, 'Invalid or overlapping accounting period'); END;
CREATE TRIGGER closed_ledger_insert BEFORE INSERT ON ledger_entry WHEN EXISTS (SELECT 1 FROM accounting_close WHERE NEW.occurredOn <= endOn) BEGIN SELECT RAISE(ABORT, 'Accounting period is closed'); END;
CREATE TRIGGER closed_ledger_update BEFORE UPDATE ON ledger_entry WHEN EXISTS (SELECT 1 FROM accounting_close WHERE OLD.occurredOn <= endOn OR NEW.occurredOn <= endOn) BEGIN SELECT RAISE(ABORT, 'Accounting period is closed'); END;
CREATE TRIGGER closed_ledger_delete BEFORE DELETE ON ledger_entry WHEN EXISTS (SELECT 1 FROM accounting_close WHERE OLD.occurredOn <= endOn) BEGIN SELECT RAISE(ABORT, 'Accounting period is closed'); END;
