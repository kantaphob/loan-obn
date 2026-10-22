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
