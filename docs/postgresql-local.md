# PostgreSQL on this Mac

The application now uses PostgreSQL 18 on `127.0.0.1:55432`, database
`loan_obn`, role `loan_obn`. Only loopback connections are accepted. The app role
is not a PostgreSQL superuser and cannot create roles or databases.

Connection secrets are stored in `.env` and `private/postgres/` with owner-only
permissions. Never commit or publish these files. The PostgreSQL data directory
is `private/postgres/data`. Keep this directory in place while the server runs.

## Starting and maintaining

- `npm run db:setup-postgres`: initialize/start this project's existing local cluster.
- `node scripts/start-local-postgres.mjs`: start the existing cluster if stopped.
- `npm run dev`: start PostgreSQL if needed, then start the application.
- `npm run db:start-postgres`: start PostgreSQL separately when running database tools without the application.
- `npm run db:generate`: generate both PostgreSQL and legacy SQLite clients.
- `npm run db:deploy`: apply the PostgreSQL migrations without resetting data.
- `npm run test:postgres`: run the integration suites against isolated PostgreSQL
  test databases, using the private local admin connection. These databases are
  removed after testing. This command must never point at a shared production server.

The Mac login startup job is `local.loan-obn.postgresql`, configured in
`~/Library/LaunchAgents/local.loan-obn.postgresql.plist`. It starts this cluster
when the user logs in; it does not expose PostgreSQL to other computers.

`prisma/schema.prisma` is authoritative for future schema changes. The generation
script derives `prisma/schema.sqlite.prisma` from it for regression testing and
legacy recovery. PostgreSQL migrations live in `prisma/migrations-postgresql`;
existing SQLite migration files remain in `prisma/migrations`.

## Backups and recovery

The application's backup page generates a `.tar` containing `database.dump`,
`manifest.json`, and private user attachments. Generated profile JSON files are
rebuildable with `npm run storage:sync` and are omitted. Database credentials,
the database server directory, and previous backups are excluded. Legacy SQLite database files and backups were retired after a current PostgreSQL restore verification.

Automatic local backups use `private/backups/automatic/ProgressSQL-latest.tar`
and daily dated archives. The existing optional Drive destination is retained.

To restore a PostgreSQL archive, stop application writes, extract it into a private
staging directory, create an empty replacement database, and use PostgreSQL 18's
`pg_restore --exit-on-error --no-owner --no-acl --dbname REPLACEMENT database.dump`.
Use private environment variables for authentication, never a command containing
a password. Restore `private/` and `uploads/` from the archive to the project,
point `.env` at the restored database, run `npm run storage:sync`, verify counts,
relationships and financial totals, then restart the application.

The first version of the archive used `files/private/` rather than `private/`;
read its `manifest.json` before copying attachments.

## Migration evidence and rollback

The original migration report remains at `private/postgres/migration-report.json` as audit evidence. Before retiring SQLite, a fresh PostgreSQL archive was restored to an isolated database and all 64 current application tables matched by row count and content hashes, including attachments and workspace payloads.

Legacy SQLite database files, old SQLite backups, and the previous connection settings have been removed. The retirement manifest is `private/postgres/legacy-sqlite-retirement.json`. Use the verified PostgreSQL archives for recovery.

SQLite schemas and clients remain only for isolated regression tests and historical migration tooling. The live application requires an explicit PostgreSQL `DATABASE_URL` and never falls back to SQLite.
