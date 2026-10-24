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
