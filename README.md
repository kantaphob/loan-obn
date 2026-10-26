# Loan OBN

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Realtime loan notifications

The app runs Next.js and its WebSocket endpoint from `server.mjs` in one Node.js process. For production, run `npm run build` followed by `npm start`, keep the process alive, and route WebSocket upgrades for `/api/realtime` to this server.

After a trusted API saves a loan status change, publish the event:

```ts
import { publishLoanStatusChanged } from '@/lib/realtime'

publishLoanStatusChanged(application.applicationNumber, application.status)
```

Publish only after the database transaction succeeds. Connected dashboard clients receive a toast and a `loan-status-changed` browser event. The event contains the application number and status only. The current project has no loan status mutation route yet, so call this helper from that route when it is added.

The broadcaster is in-memory and intended for a single Node.js process. If the app later runs across multiple processes or machines, use shared pub/sub such as Redis so every connected client receives each update.

## Database and private storage

The application, Prisma CLI, Prisma Studio and seed scripts use PostgreSQL via `DATABASE_URL` in `.env`. See [PostgreSQL setup and recovery](docs/postgresql-local.md).

PostgreSQL is the single live database for borrowers, lenders, contracts, accounting, ASSET and Property. Local server files are in `private/postgres/data`. Backups are PostgreSQL `.tar` archives containing a `database.dump` and private attachments. Legacy SQLite data files have been retired after verifying a current PostgreSQL backup restore. SQLite clients and migration sources remain solely for isolated regression tests and historical migration tooling.

`private/` is excluded from Git and is never served publicly. Use the application's backup page to create a PostgreSQL archive; do not copy the running PostgreSQL data directory as a backup.

For a new empty installation, use `npx prisma migrate deploy --config prisma7.config.ts`. To inspect the configured database, use `npx prisma studio --config prisma7.config.ts`. Seed commands use the same shared database configuration; do not reseed an existing database just to move it.

### Borrower image files

Live Line QR images and card photos are stored in `private/borrower/<random-id>.png` with private file permissions. PostgreSQL stores the image references. The application serves them through `/api/borrowers/<id>/line-qr` and `/api/borrowers/<id>/card/photo`; do not move these files into `public/`.

Run `npx tsx scripts/migrate-borrower-images.ts` to extract legacy inline database images. It first creates a database backup, preserves record timestamps, checks for concurrent changes and is safe to rerun. Old inline images remain readable for compatibility with older backups.

Back up both `private/database` and `private/borrower` when copying storage manually. Backups created through the application's backup screen embed image bytes in the backup database so its downloadable `.db` remains self-contained. New image saves replace the file reference only after validation; replaced/deleted images are removed after the database change succeeds.
