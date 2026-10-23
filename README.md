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

The application, Prisma CLI, Prisma Studio and seed scripts all use `lib/database-config.ts` to resolve the same SQLite file:

```text
private/
  database/
    ProgressSQL.db
  backups/
    database-move-<timestamp>/
      ProgressSQL.db
      verification.json
```

Set `DATABASE_URL="file:./private/database/ProgressSQL.db"` in `.env` (see `.env.example`). The directory is created automatically for a new installation. Existing installations must move their database before changing this setting; changing a path alone does not migrate data.

All categories share this database: borrowers, lenders, bank/payment masterdata, user accounts, saved Line QR images and saved smart-card data/photos. Category-specific APIs read the relevant records; these private files do not belong in `public/`.

`private/` is excluded from Git and is not served by Next.js. To back up a running installation, use SQLite's backup API so the backup includes committed WAL data. When moving the database, stop the server and other database writers first, verify the copy, update `.env`, then restart. Keep the original as a private backup until the move is verified. The `verification.json` from this move records row counts and content hashes for every table.

For a new empty installation, use `npx prisma migrate deploy --config prisma7.config.ts`. To inspect the configured database, use `npx prisma studio --config prisma7.config.ts`. Seed commands use the same shared database configuration; do not reseed an existing database just to move it.
