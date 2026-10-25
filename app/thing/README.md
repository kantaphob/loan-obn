# Assets and liabilities

The sidebar group สินทรัพย์และหนี้สิน exposes these independently addressable pages:

- `/thing/property`: create PROPERTY groupings from separate land and building assets, with derived cost totals.
- `/thing/asset`: source asset registry (including land and buildings).
- `/thing/property/boq`: construction BOQ; choose manual price or BOQ as the main house cost.
- `/thing/property/built-in`: built-in BOQ by room, including replacement of older BOQ rows.
- `/thing/property/inventory`: equipment, warranty, serial numbers, room movements and lifecycle status.
- `/thing/property/valuations`: dated, sourced valuations and equity, separate from historical cost.
- `/thing/asset/payments`: actual debt payments and remaining principal.
- `/thing/property/history`: historical snapshots, JSON exports and validated restore previews.

## Data and backup

`AssetData` v2 has independent `homes` and `loans` collections. Each bank loan can
optionally reference one asset. Payments belong to loans, never to the house price.
The existing operator identity is used, with active status and reviewer write restrictions.
Masterdata supplies category codes and their hierarchy.

The optional `properties` collection stores only `{ id, code, name, landId, buildingId }`.
Older v2 payloads without it remain compatible. A PROPERTY is not another `Home`:
its total is derived through `propertyCosts` from the two source assets, and is never
added again to asset totals or posted to the ledger. Server validation requires
distinct, active LAND and BUILDINGS category members, excludes HOUSE_WITH_LAND
sources, and prevents sharing a component between multiple properties. Reassign a
property before archiving one of its sources. Category changes are checked too.

The creation form offers existing assets or new LAND/BLD records saved atomically
with the relationship using the existing permissions, revision checks and audit
snapshots. Its initial editable example is deed XXX (1,000,000 baht) plus house 99
(BOQ 1,970,000 baht), forming PROPERTY-001 (2,970,000 baht). These are draft values,
not seeded financial data. The initial BOQ is one user-supplied summary row with
zero paid amount. Any future detailed BOQ must replace this summary rather than
add the same budget again. Land valuation is separate from purchase cost.

The workspace payload lives in `AssetWorkspaceState` in the existing SQLite database.
Each successful transaction also writes an `AssetWorkspaceRevision`, with a reason,
operator, revision number, timestamp and complete payload. Optimistic revision checks
reject stale writes. Existing database backups include both tables.

On first load, the former `private/assets/<operator-id>.json` file is imported if
present (or `ASSET_DATA_DIRECTORY` when configured). Migration copies the data and
separates debts; the original file is retained unchanged. Without legacy data, the
owner-supplied GHB contract reference initializes the workspace, without invented
payment dates or actual payments. A migration row is retained in the revision log.

JSON restoration previews counts and requires explicit confirmation. It is subject
to the same date, contract, category and ledger-link validation as normal writes.
Recorded contracts cannot be removed or rewritten by a restore. Equipment movements
and status changes retain item records and append movement events.

## Cost and debt rules

- Main price = entered purchase price OR sum of active BOQ rows, not both.
- Both construction and built-in BOQ contribute when BOQ is selected as main price.
- A replacement cancels the previous budget row while retaining its actual paid amount.
  The replacement's price becomes the current BOQ contribution; sunk spend remains visible.
- Equipment linked to an active BOQ row is not added again when BOQ is the main price.
  An explicit included-in-main-price flag covers equipment included in lump-sum prices.
- Removed/sold/retired equipment stays in history and is excluded from current additions.
- BOQ spending may exceed budget. Display the difference rather than rejecting real spending.
- Market valuations are dated and sourced, never automatically inflated each year.
- Initial GHB reference: 2,600,000 baht / 480 months. The supplied rate for year seven
  is provisionally continued afterwards; verify actual contract terms before use.
- Actual payments use bank-reported interest, principal = total minus interest.
  Future-dated actual payments are rejected. Fees are separate.
- Retention carries the previous round's exact remaining principal. Terms with payments
  or later rounds are locked by the server, not only by disabled UI controls.
- Payment summaries select the effective contract round as of today, not a future round.
- Forecasts use monthly interest and a fixed MRR reference, from the selected round's
  beginning. They are labeled estimates and do not replace bank daily-interest statements.
- A linked ledger outflow must be active, have the same amount (and date for debt payments),
  and may be used only once in the workspace. Linking never creates another ledger entry.
  BOQ ledger linking currently supports one entry for the row's cumulative paid amount;
  split installment allocations are not yet supported.

## Checks

`npm run test:assets` runs financial unit and isolated database/action tests.

`npx eslint app/thing` and `npx tsc --noEmit --incremental false` check the implementation.

Documents, multiple warranty components, a floor-plan editor, QR labels and scheduled
maintenance reminders are not part of this implementation. The reference attachment
is a design brief; its illustrative PDF prices and market values are not imported.

## Folder ownership

- `asset/`: bank debt landing page and `payments/`.
- `property/`: asset registry, `boq/`, `built-in/`, `inventory/`, `valuations/`, `history/`, property categories, and `_components/`.
- `_shared/`: cross-domain workspace model, persistence actions, validation, integrity checks, shell, styling and history component.
- `_draft/`: archived UI drafts, excluded from routing and compilation.

The old flat `/thing/bank-loans`, `/thing/payments`, `/thing/boq`,
`/thing/built-in`, `/thing/inventory`, `/thing/valuations`, and `/thing/history`
URLs redirect through `next.config.ts`; no duplicate route folders are retained.

## Relational land register

`prisma/migrations/20261026050000_land_register` adds the SQLite-compatible land register. All relationships include `operatorId`; category references use `asset_category`. Existing workspace JSON and audit revisions remain the editor's source of truth during this transition. `saveAssetWorkspace` updates the relational projection in the same transaction, so failed writes cannot split the two representations.

- `Asset`: existing UUID, generated category code, name, category, archive status.
- `Land`: title/deed identifiers, location, rai/ngan/square wah, coordinates and physical details. Square metres are derived rather than stored twice.
- `AssetParty` / `LandOwnership`: reusable people/organizations and dated ownership shares.
- `LandAcquisition` / `AssetTransaction`: acquisition details and purchase/other transaction amounts. Money uses integer satang (`BigInt`). This register does not post ledger entries or bank payments.
- `AssetValuation`: dated appraisal, asking price and sale price records. Stable source keys prevent duplicate history on repeated saves; recording a sale price does not itself execute a sale.
- `LandEncumbrance`: registration/release details for mortgages and other burdens; actual debt remains in the loan system.
- `AssetDocument`, `LandBoundary`, `LandParcelHistory`: private document storage references, surveyed coordinates, subdivision/consolidation links.
- `BuildingLand`: connects existing building assets to land without copying costs.

Run `npm run db:backfill-land` after deploying the migration to project existing snapshots into these tables. It is idempotent, does not change snapshots or audit history, and preserves supplemental fields. Missing legal/title/owner details are not invented. Existing forms currently write deed number, area, address, purchase price/date and price history. Additional ownership/title/location/encumbrance/document editing screens are not implemented by this schema change. Ownership percentages are individually constrained to 0–100; any future ownership service must additionally validate overlapping periods and combined shares. Use soft archive for assets; referenced land and owner records are protected from hard deletion.
