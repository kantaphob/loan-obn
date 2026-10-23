# Record storage

SQLite is the source of truth at `private/database/ProgressSQL.db` (or `DATABASE_URL`).
The custom server exports current records at startup and after mutation requests.
Each generated file follows `private/<category>/<code>/<code>-profile.json`.
Numeric IDs use at least four digits: `LN-0001`, `BR-0001`. Existing database IDs
and borrower codes are preserved. User IDs and master-data codes retain their
existing identity with a section prefix; no new sequential IDs are assigned to them.

Sections: lenders, borrowers, users, user-profiles and masterdata (categories,
banks, interest-rates, loan-statuses, risk-ratings, payment-channels, provinces,
districts, subdistricts, postcodes). Contracts and activity logs do not yet have
persistent models, so no records are exported for those screens.

JSON files contain a snapshot, including currently stored card and QR data.
User password hashes are excluded. Do not serve private through static hosting.
Files are written by atomic rename, with owner-only permissions. Editing a JSON
file does not update the database. Deleted records remove only generated profile
files and preserve attachments. The manifest tracks only generated profiles.

Run `npm run storage:sync` to refresh all files after CLI/seed imports or to repair
an interrupted export. Synchronization failures are logged; the committed database
remains authoritative and startup/manual synchronization repairs the snapshots.
Database backups remain in `private/backups`; JSON exports do not replace backups.

Successful API mutations create an automatic SQLite snapshot at
`private/backups/automatic/ProgressSQL-latest.db` and refresh one dated snapshot
per day. Borrower card and QR images stored outside SQLite are embedded in the
snapshot so it can be restored on its own. Snapshots use owner-only filesystem
permissions. If `LOAN_DRIVE_BACKUP_DIR` points to an existing, writable folder in
Google Drive for desktop's local My Drive, the latest and dated snapshots are
also copied there. When Drive is unavailable, the local snapshot remains and a
Drive copy is attempted again after the next successful update. Do not point
this setting at a public or shared folder; backups contain personal and financial
data.
