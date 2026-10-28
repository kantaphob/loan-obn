CREATE TABLE persuader_share_event (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  contractId INTEGER NOT NULL,
  persuaderId INTEGER NOT NULL,
  ledgerEntryId INTEGER NOT NULL,
  eventType TEXT NOT NULL,
  amountSatang REAL NOT NULL,
  createdBy TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT persuader_share_event_contractId_fkey FOREIGN KEY (contractId) REFERENCES loan_contract(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT persuader_share_event_persuaderId_fkey FOREIGN KEY (persuaderId) REFERENCES persuader(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT persuader_share_event_ledgerEntryId_fkey FOREIGN KEY (ledgerEntryId) REFERENCES ledger_entry(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX persuader_share_event_ledgerEntryId_eventType_key ON persuader_share_event(ledgerEntryId, eventType);
CREATE INDEX persuader_share_event_persuaderId_createdAt_idx ON persuader_share_event(persuaderId, createdAt);
CREATE INDEX persuader_share_event_contractId_createdAt_idx ON persuader_share_event(contractId, createdAt);

CREATE TABLE persuader_share_payment (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  contractId INTEGER NOT NULL,
  persuaderId INTEGER NOT NULL,
  ledgerEntryId INTEGER NOT NULL,
  amountSatang REAL NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT persuader_share_payment_contractId_fkey FOREIGN KEY (contractId) REFERENCES loan_contract(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT persuader_share_payment_persuaderId_fkey FOREIGN KEY (persuaderId) REFERENCES persuader(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT persuader_share_payment_ledgerEntryId_fkey FOREIGN KEY (ledgerEntryId) REFERENCES ledger_entry(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX persuader_share_payment_ledgerEntryId_key ON persuader_share_payment(ledgerEntryId);
CREATE INDEX persuader_share_payment_persuaderId_createdAt_idx ON persuader_share_payment(persuaderId, createdAt);
CREATE INDEX persuader_share_payment_contractId_createdAt_idx ON persuader_share_payment(contractId, createdAt);

INSERT INTO financial_category (code, nameTh, nameEn, "group", direction, sortOrder, isActive, createdAt, updatedAt)
VALUES ('PERSUADER_SHARE_PAYMENT', 'จ่ายส่วนแบ่งผู้แนะนำ', 'Persuader referral share', 'EXPENSE', 'OUT', 225, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(code) DO NOTHING;
