ALTER TABLE ledger_entry ADD COLUMN principalReceivedSatang REAL;
ALTER TABLE ledger_entry ADD COLUMN interestReceivedSatang REAL;
ALTER TABLE ledger_entry ADD COLUMN penaltyReceivedSatang REAL;
ALTER TABLE accounting_close ADD COLUMN kind TEXT NOT NULL DEFAULT 'LEGACY';
CREATE TABLE accounting_month_lock (
 id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 requestKey TEXT NOT NULL, month TEXT NOT NULL, startOn TEXT NOT NULL, endOn TEXT NOT NULL,
 note TEXT NOT NULL, snapshotJson TEXT NOT NULL, createdBy TEXT NOT NULL,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX accounting_month_lock_requestKey_key ON accounting_month_lock(requestKey);
CREATE UNIQUE INDEX accounting_month_lock_month_key ON accounting_month_lock(month);
CREATE UNIQUE INDEX accounting_month_lock_endOn_key ON accounting_month_lock(endOn);
CREATE TRIGGER month_lock_no_update BEFORE UPDATE ON accounting_month_lock BEGIN SELECT RAISE(ABORT, 'Monthly reviews are immutable'); END;
CREATE TRIGGER month_lock_no_delete BEFORE DELETE ON accounting_month_lock BEGIN SELECT RAISE(ABORT, 'Monthly reviews are immutable'); END;
CREATE TRIGGER month_lock_order BEFORE INSERT ON accounting_month_lock WHEN NEW.startOn > NEW.endOn OR EXISTS (SELECT 1 FROM accounting_month_lock WHERE endOn >= NEW.startOn) BEGIN SELECT RAISE(ABORT, 'Invalid or overlapping month'); END;
CREATE TRIGGER month_closed_ledger_insert BEFORE INSERT ON ledger_entry WHEN EXISTS (SELECT 1 FROM accounting_month_lock WHERE NEW.occurredOn <= endOn) BEGIN SELECT RAISE(ABORT, 'Accounting month is locked'); END;
CREATE TRIGGER month_closed_ledger_update BEFORE UPDATE ON ledger_entry WHEN EXISTS (SELECT 1 FROM accounting_month_lock WHERE OLD.occurredOn <= endOn OR NEW.occurredOn <= endOn) BEGIN SELECT RAISE(ABORT, 'Accounting month is locked'); END;
CREATE TRIGGER month_closed_ledger_delete BEFORE DELETE ON ledger_entry WHEN EXISTS (SELECT 1 FROM accounting_month_lock WHERE OLD.occurredOn <= endOn) BEGIN SELECT RAISE(ABORT, 'Accounting month is locked'); END;
-- Changing financial inputs requires a fresh review of repayment allocation.
CREATE TRIGGER reset_repayment_allocation AFTER UPDATE OF amountSatang, occurredOn, contractId ON ledger_entry
WHEN NEW.amountSatang != OLD.amountSatang OR NEW.occurredOn != OLD.occurredOn OR NEW.contractId IS NOT OLD.contractId
BEGIN UPDATE ledger_entry SET principalReceivedSatang=NULL, interestReceivedSatang=NULL, penaltyReceivedSatang=NULL WHERE id=NEW.id; END;
