# Financial integrity and database installation

## Fresh installation and upgrades

Run `npm run db:deploy` before starting an installed copy. For authoring new migrations use `npm run db:migrate`.

Existing databases use the normal Prisma deploy process. Empty databases replay the **unchanged** historical SQL, moving only the consent migration after its loan-contract dependency. Prisma then records every original migration name and checksum using `migrate resolve --applied`. The temporary database must pass integrity checks before it replaces the empty destination. Never reset an existing database to fix installation problems. Direct `prisma migrate deploy` on an empty database still follows the historical broken order; use the wrapper.

`npm run test:integrity` tests fresh SQL installation, duplicate-proof constraints, credit reservations, historical balances, retry behavior and post-commit backups. The CLI installation path is also verified against an empty disposable database. Existing migration files remain unchanged.

## Credit availability

The authoritative position is calculated from contracts and active ledger entries. Outstanding principal consumes credit; WAITING_PAYMENT contracts reserve principal before cash is paid. Available credit is approved credit less both amounts. The stored imported used-limit value is a fallback only when there are no relevant contracts. The server checks the position inside the create-contract transaction; a request retry does not reserve credit twice. Historical imports are not rejected just because they predate a present-day limit.

## Proofs and references

Active BANKING/PROMPTPAY references are compared case-insensitively after trimming whitespace, across both channels. SHA-256 fingerprints detect byte-identical slips across active entries. A database partial unique index also protects newly fingerprinted slips against concurrent submissions. Legacy slips with no stored fingerprint are checked on read. Voided entries do not block rebooking. Reusing one transfer across multiple new entries requires an explicit allocation workflow, which is not implemented: record one transfer once.

This does not verify bank authenticity or detect a re-encoded/cropped image. Historical records are retained; no payments, dates or slips are deleted automatically. During the audit, TX-000009 and TX-000010 shared one image; their historical principal/interest allocation must be reviewed before changing either entry.

## Persistence and backups

The Prisma client preserves lazy Prisma promises. Standalone model writes trigger file synchronization and a verified SQLite snapshot after success. Callback and array transactions trigger those effects only after commit. Rollbacks do not run them. Backup errors are logged separately and do not report a committed payment as failed. Backups include stored slip bytes in SQLite. Test runners disable real file/network side effects and use isolated databases.

## Google synchronization

Mutations enqueue entity IDs in `google_sync_job`. A Node server worker drains due jobs every 30 seconds while the app is running. Errors persist and retry with exponential backoff up to 15 minutes; work survives restart. Version checks prevent an older upload from marking a newly modified entity synced. Expired processing leases recover interrupted jobs. Slip upload failures fail the job, so a row is not falsely treated as synced without its attachment.

Masterdata shows pending/failed/synced counts and the last successful sync, with a manual retry button. Trade-payable payments use the same ledger queue. No Google request is made without the existing bridge configuration. A successful Google status means delivery succeeded, not an independent reconciliation of hand-edited sheet values.

## AP review, approval and pre-disbursement amendments

Opening an approval or payout dialog loads the latest borrower exposure and outstanding contracts. Approval requires an explicit confirmation of the summary. The server verifies a digest of the reviewed contract, its version, borrower limits and current exposure; if these change, the user must reopen the dialog.

After approval, pending contracts can amend principal, the planned disbursement date, the repayment due date and the collateral description, with a required reason. Date-only changes preserve existing amounts and approval. An increase that exceeds the available limit requires renewed approval. Paid contracts cannot be amended through this action. Editing a captured signed contract requires confirmation, archives the signed snapshot in `contract_revision`, clears live signatures and requires signing the amended electronic documents before disbursement. Changing parties or document types requires a new contract.

The payout dialog shows the contract and exposure summary again. A slip remains optional. The AP payout API requires the current review digest and the ledger transaction checks it before changing status and recording money out. Existing ledger idempotency and duplicate-proof checks still apply. Opening a dialog or approving a reservation creates no cash movement.

## Monthly review and year-end closing

- `/dashboard/ac` separates monthly review/locking from year-end closing journals. Monthly review records cash movements and contract balances as of month end; it neither posts profit transfers nor changes loan status.
- Locks start in January and proceed one complete month at a time. Database triggers protect all Ledger entries through the latest locked date, including voids and attempts to move entries to another period. Stored month snapshots and annual journals are immutable.
- Active repayment entries must have reviewed principal/interest allocation before their month can be locked. Penalty allocation follows the existing payment timeline; principal and interest are explicitly checked against supporting records. Upfront interest cannot be counted again in principal repayments. Allocation changes require an admin, an expected revision, and an audit reason.
- Changing payment amount/date clears the allocation and requires review again. Historical/legacy balances are not automatically assigned a principal/interest split.
- Annual closing currently follows January–December and requires all 12 monthly locks. Reviewed trial balances, including accrual/deferral adjustments, remain the input for Income Summary and capital/retained earnings closing. Cash received is not automatically treated as accrual revenue.
- Loan contracts close through the repayment workflow when the remaining contractual debt and penalties are settled or explicitly waived with reasons; monthly and annual accounting actions never settle a loan.

## Closing document folders and financial workpapers

- `/dashboard/ac?year=2025` and `?year=2026` provide year folders and monthly tables. Loan-ledger cash and historical imported cashbook totals remain separate; the application does not assume they are distinct economic transactions and does not merge their revenue.
- Month preparation has versioned, audited checks for documents, bank/cash, receivables/payables, inventory, fixed assets and adjustments. N/A requires an explanation. Checks must be completed before a month can close; unavailable contract PDFs additionally require an explanation in the document check.
- Contracts and slips remain attached to their original records. Month closing copies original slip/attachment bytes and generates a PDF snapshot for an available loan agreement. Where an agreement PDF is unavailable, a clearly named JSON contract-data snapshot is stored instead; this is not a signed agreement. Manually signed agreements can be uploaded separately. Document hashes and the final manifest are retained, and closed-month documents cannot be changed.
- Additional PDF/JPG/PNG evidence is stored privately in the database (5 MB/file, 50 MB of additional uploads/month). The complete captured month is bounded to 100 MB. Active users can retrieve authorized documents and download a closed month as a ZIP with the stored summary; documents are never served from a public directory.
- Year workpapers take a reviewed **pre-adjustment year-end trial balance**, not January opening balances and not the cash ledger. Typed account balances plus immutable balanced adjustment entries produce an adjusted trial balance, draft income/position/equity statements, notes, and the four-step closing journal. Depreciation, allowances and accruals are entered as reviewed adjustments; their recognition is not inferred from cash movements.
- Closing from a workpaper requires all twelve monthly locks, a completed year, a balanced trial balance, a reconciled owner-equity movement, consistent drawings/dividend classification, notes and an unchanged review token. The full workpaper is captured in the immutable year-close record. Posting adjustments never changes cash Ledger amounts and never makes a bank transfer.

## Cash carryforward across months and years

- The closing page and capital cash summary now use the same read-only cash continuity calculation: prior recorded receipts minus payments become opening money; opening + current-period receipts − current-period payments becomes closing money. Opening is never posted as a synthetic Ledger receipt or classified as income/profit.
- The user confirmed that the 10,570 baht of 2026 `OPENING_CAPITAL` entries is **fresh additional funding**, not a duplicate of 2025 closing cash. Those entries remain counted once as 2026 receipts on top of the prior-year opening. No source entries are rewritten or voided for this feature.
- Historical cashbook years can feed subsequent live-Ledger years. If both sources (or multiple imported account codes) occur in the same year, the combined figure is withheld pending source reconciliation; source breakdown remains visible. This avoids silently combining overlapping exports with live postings.
- Current cash uses posted movements only, excludes voids and future dates, and never adds contractual receivables, waived debts, or legacy received totals as new cash. It reflects the history available in the system and still requires comparison with cash/bank evidence.
- New monthly closing snapshots include opening/closing cash and its source breakdown. Previously frozen archives are retained as-is. Year workpaper trial balances and owner equity are not automatically inferred from cash carryforward.
