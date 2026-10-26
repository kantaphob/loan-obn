# Assets and liabilities

The sidebar group สินทรัพย์และหนี้สิน exposes these independently addressable pages:

- `/thing/property`: create PROPERTY groupings from separate land and building assets, with derived cost totals.
- `/thing/asset`: source asset registry (including land and buildings).
- `/thing/liabilities`: loan contracts and retention rounds, actual disbursements,
  projected repayment schedules, payment splits, balances and contract/slip attachments.
- `/thing/property/boq`: construction BOQ; choose manual price or BOQ as the main house cost.
- `/thing/property/built-in`: built-in BOQ by room, including replacement of older BOQ rows.
- `/thing/property/inventory`: equipment, warranty, serial numbers, room movements and lifecycle status.
- `/thing/property/valuations`: dated, sourced valuations and equity, separate from historical cost.
- `/thing/asset/payments`: actual debt payments and remaining principal.
- `/thing/property/history`: historical snapshots, JSON exports and validated restore previews.

## Data and backup

`AssetData` v2 has independent `homes` and `loans` collections. Each bank loan can
optionally reference multiple source assets through `assetIds`, such as land and a
house in one contract. Legacy `assetId` links remain readable; new saves mirror the
first selected ID there. Debt and payments belong once to the contract, not once
per linked asset, and never to the house price.
The existing operator identity is used, with active status and reviewer write restrictions.
Masterdata supplies category codes and their hierarchy.

The optional `properties` collection stores grouping metadata and `assetIds`.
Legacy `{ landId, buildingId }` snapshots and PROPERTY-001 codes remain readable;
new groups use PROP-001 codes. A group can start with land only and later contain
multiple parcels, buildings and improvements categorized under BUILDINGS. Sources
must be active, independently costed LAND/BUILDINGS records; HOUSE_WITH_LAND is
excluded because it already combines costs. An asset may belong to one group only.

The `/thing/property` page selects existing assets rather than inventing new source
records or prices. It supports names, usage type, lifecycle status, structured
address, coordinates, searching, adding/removing members and dissolving a grouping.
Removing a membership or dissolving a group preserves all source assets and costs.
`propertyTotalCost` derives costs through `assetCosts`, including its existing BOQ
and equipment deduplication rules. Appraisal values are deliberately not summed:
a valuation may already cover the entire house and land.

`Property` and `PropertyAsset` are relational projections of the versioned workspace,
just like the existing Asset/Land register. Every save commits projections, workspace
revision and audit snapshot atomically. Composite workspace keys and a unique
(operatorId, assetId) membership constraint prevent cross-workspace or duplicate
links. Property stores no money fields. `linkedAt` is retained on unchanged links.
Known BuildingLand relationships are preserved inside a grouping; adding multiple
parcels does not imply every building physically occupies every parcel.

Migration `20261026060000_property_register` adds only the two new tables.
`npm run db:backfill-land` also backfills Property projections from saved payloads;
it does not manufacture memberships or update historical audit snapshots. This
installation continues using its configured SQLite database through Prisma.

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

The Loan Contract tab is the single contract-settings form: total credit, pre-existing
opening debt, term in months, optional effective date, reference MRR, document
reference interest, monthly interest in year one, annual interest thereafter and
annual bank installments. Identity and asset selection remain in the metadata form.
Existing rate steps stay intact unless interest rows are edited or the supplied
GHB terms are explicitly applied. GHB terms retain qualifying/non-qualifying life
insurance and welfare/retail/equipment customer selection, with floating MRR-minus
discount formulas. Existing within-year installments are preserved unless the
annual installment fields are edited. Editing metadata alone preserves the contract.
Contract settings remain editable after drawdowns or payments through the dedicated
authenticated `saveBankLoanContractSettings` action. Edits update the workspace and
an audit revision atomically, preserving actual payments, disbursements and ledger
links. Later retention openings are recalculated from the amended prior balance;
all date, credit and reconciliation checks still apply. Generic workspace saves and
restores retain their historical-term protection. Editing creates no ledger transaction.
Payoff duration and interest savings are not imported from
spreadsheet summary cells as actual results.
The first round's optional `creditLimit` stores total borrowing separately from its
opening remaining debt. Optional `openingBalance` carries pre-existing debt into
explicit drawdown tracking without manufacturing a receipt or historical payment.
Subsequent draws plus opening debt cannot exceed total credit. Legacy loans without
these fields retain their original balance behavior.

Liabilities opens each loan on a combined receive/pay view, showing recorded
disbursements and payments for that contract with separate receipt and payment
columns. Existing balances are not manufactured into receipt transactions.
One Add Receive/Pay button opens a direction selector with date, amount, channel,
reference and notes. Outflows select a contractor agreement and work stage.
The list filters by direction and searches date, reference, notes, contract code,
counterparty and TX number. Bank receipts can be dated even while the contract
effective date is unknown, without inventing it; an entered effective date still
bounds receipt dates. Contractor payments do not depend on bank interest dates.
Receive/Pay, Receipt Tranches, Contractor Contracts and Loan Contract are shown in
the loan navigation. The cashbook is for construction funding: RCV entries receive
bank drawdowns; PAY entries pay contractor work stages. Bank debt repayments remain
separate and are never inferred from a payment to a builder.
Contractor contracts have a unique CT code per loan, contractor, total agreed price,
optional signed date, work description and numbered stages with amounts/due dates.
The shared cash form's OUT direction selects a contract and stage and records an
ordinary dated cash payment, with channel/reference/notes. It creates an OUT ledger
entry in CONTRACTOR_PROGRESS_PAYMENT (ASSET group), preserving bank principal.
Amounts cannot exceed a stage's remaining agreement or the total contract. Replays
do not duplicate money; overpayments roll back; linked payments cannot be removed
or changed separately from ledger. All contract edits and payments have revisions.
These cashbook payments are not automatically added again to source asset costs.
Land purchase agreements use the same audited payment-agreement structure with
`kind: land_purchase`, a separate LC code, seller, optional deed/parcel reference
and location, agreed price and payment stages (such as deposit and transfer).
They appear on their own Land Purchase Contract tab, while legacy agreements
without a kind remain construction contracts. The cashbook selects either type;
land outflows use LAND_PURCHASE_PAYMENT in ledger, preserve bank principal and do
not rewrite the source land purchase price. A paid agreement cannot switch type.
Agreement stages can store an optional percentage of the full contract price.
Percentage mode requires a 100% schedule and derives monetary amounts; the last
stage absorbs satang rounding so the total equals the price exactly. Amount mode
preserves older fixed-amount stages. Explicit template buttons fill the supplied
land price 400,000 at 70/30 and house price 2,600,000 at 20/20/15/15/15/10/5 (seven
stages), ready for review and counterparty entry. They do not save or post cash
automatically. Percentages and calculated amounts persist in the workspace/audit
database and are validated again on the server.
The Work Additions/Deductions tab (งานเพิ่ม–งานลด) records VO-coded changes to
construction agreements with BOQ/quote references, quantity, unit, unit price,
dated scope and draft/approved/cancelled status. Only approved changes affect the
net price: original + additions - deductions. Original contract price and stage
percentages are retained. Changes can adjust an original stage; an approved
addition without a target stage becomes a separate payable VO stage. Deductions
must target an original stage. Derived payment stages and caps are used consistently
by the cash form, server save, contract display and ledger action. A paid stage
cannot be reduced below payments already recorded, and paid extra work cannot be
cancelled out of the stage list. Variation records are retained and cancelled rather
than deleted; workspace revisions preserve their edits. Agreements never post cash
automatically and never rewrite the source BOQ or bank loan balance.
The Receipt Tranches tab (งวดรับ) lists bank receipts by draw number, receipt date,
amount, reference and linked TX. Add Receipt opens the shared cash form in IN mode.
Receipts optionally retain `drawType` (land / house); new forms require a type.
Draw numbers are positive integers, unique per loan and type, so land #1 and house
#1 coexist. The form suggests the next number within the selected type. Duplicate
numbers in that type roll back the receipt and ledger entry together. Old untyped
receipts remain in their unspecified group and are not guessed or reclassified.
Receipt tables filter by type and show separate totals/counts. Ledger categories
BANK_LOAN_LAND_RECEIVED and BANK_LOAN_HOUSE_RECEIVED distinguish new typed receipts;
the original BANK_LOAN_RECEIVED code remains for legacy untyped requests.
Contract, receipt, payment and loan-metadata save feedback uses the shared toast
provider for success and errors, while forms retain relevant inline validation.
New loans start with explicit disbursement
tracking: principal is the amount actually drawn, less recorded principal payments.
Draws must be dated within the first contract round, cannot exceed its credit limit,
and cannot be changed after retention. Legacy loans without `disbursements` retain
their opening-balance semantics; loans with existing payments cannot switch modes.
Retention carries the previous round's drawn balance and does not create new draws.

Payments store total principal (including `extraPrincipal`), bank-reported interest,
fees and penalties. Cash paid equals principal + interest + fee + penalty; extra
principal is not added twice. The actual balance ignores forecast rows. The schedule tab currently shows an empty state; fictional example contracts and
their repayment tables are not displayed.
The pasted spreadsheet examples are references only; they are not actual transactions.

Loan documents can reference a storage location or attach PDF/JPEG/PNG files up to
1 MB each, optionally linked to a recorded payment. They persist in the authenticated,
versioned workspace, under its existing 4,000,000-character total save limit.
Receiving a loan or paying an installment through this page creates one GENERAL
ledger entry (IN / BANK_LOAN_RECEIVED or OUT / BANK_LOAN_PAYMENT) and its debt link
in the same transaction, including an audit revision. Categories use the LIABILITY
group, separate from lending to borrowers. A channel is required. The full cash
payment, including fees, goes to the ledger; only principal reduces the debt.
Stable request keys make matching retries idempotent. Invalid splits, overdraws,
closed accounting periods, duplicate references and stale revisions roll back both
records. Linked bank-debt entries cannot be edited or voided independently in the
ledger, or removed/changed through a workspace save. Historical records are not
automatically posted again.

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
- `BuildingBoqItem`: searchable construction and built-in BOQ rows keyed to the source asset. Quantity remains numeric; monetary values use integer satang; source unit rates, line totals, notes, payment links, replacement and cancellation state are retained.
- `Land`: title/deed identifiers, location, rai/ngan/square wah, coordinates and physical details. Square metres are derived rather than stored twice.
- `AssetParty` / `LandOwnership`: reusable people/organizations and dated ownership shares.
- `LandAcquisition` / `AssetTransaction`: acquisition details and purchase/other transaction amounts. Money uses integer satang (`BigInt`). This register does not post ledger entries or bank payments.
- `AssetValuation`: dated appraisal, asking price and sale price records. Stable source keys prevent duplicate history on repeated saves; recording a sale price does not itself execute a sale.
- `LandEncumbrance`: registration/release details for mortgages and other burdens; actual debt remains in the loan system.
- `AssetDocument`, `LandBoundary`, `LandParcelHistory`: private document storage references, surveyed coordinates, subdivision/consolidation links.
- `BuildingLand`: connects existing building assets to land without copying costs.

Land development work is recorded as child items of each land asset. The `LandDevelopment`
projection indexes work category, mobility, CAPEX/OPEX treatment, budget, actual cost, and
recognized asset value. `LandDevelopmentCost` links payments to existing ledger entries;
the workspace item keeps pricing inputs, dimensions, BOQ lines, contractor/reference details,
warranty dates, document/photo references, and maintenance history. Estimates, delivered
cost, payments, and recognized value stay separate from land purchase/appraisal values.

Run `npm run db:backfill-land` after deploying the migration to project existing snapshots into these tables. It is idempotent, does not change snapshots or audit history, and preserves supplemental fields. Missing legal/title/owner details are not invented. Existing forms currently write deed type/number, parcel and survey references, map sheet/scale/book/page, full address and district fields, rai/ngan/square wah, GPS coordinates, land use/zoning/access/utilities notes, purchase price/date and price history. Additional ownership/title/location/encumbrance/document editing screens are not implemented by this schema change. Ownership percentages are individually constrained to 0–100; any future ownership service must additionally validate overlapping periods and combined shares. Use soft archive for assets; referenced land and owner records are protected from hard deletion.

The versioned workspace payload remains the authoritative editing and restore snapshot. `BuildingBoqItem` is its normalized relational projection for searching and reporting, not a second independently edited copy. Workspace edits and project/payment saves rebuild the projection in the same transaction as the payload and audit revision, so a failed transaction cannot leave partial BOQ rows. Migration `20261026100000_building_boq_register` adds the table; run `npm run db:backfill-building-boq` after applying it to populate existing workspaces. The backfill is repeatable and leaves payload snapshots and revision history untouched.
