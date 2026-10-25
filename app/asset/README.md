# Asset workspace

`/asset` uses the existing application frame and navigation. It supports multiple
parent assets (property, vehicle, other), nested rooms/categories and items,
purchase costs versus current valuation, warranty dates, property BOQ, actual
loan payments, rate schedules, retention rounds and a monthly repayment simulation.

## Persistence

Server actions use the installation's existing operator identity and reject writes
for inactive operators and reviewers. Data is stored per operator in
`private/assets/<operator-id>.json`, with revision checks and atomic rename. A
directory lock prevents concurrent writers across processes. `ASSET_DATA_DIRECTORY`
can select a separate directory for verification or a mounted persistent volume.
Keep the directory private and on persistent storage. It is **not included in the
existing database backup**. The UI exports JSON backups; restoration currently
requires replacing the operator file while the app is stopped. If a process is
terminated while saving, remove a leftover `<operator-id>.lock` directory only
after confirming there is no writer running.

## Loan rules

- Initial contract values come from the owner's reference, not a live bank feed.
  No actual payments or contract start date are seeded. The 5.145% rate from year
  seven is provisionally extended to contract end; verify later-year terms before
  recording payments. MRR is an editable reference, never presented as live data.
- Every schedule covers its round continuously from month 1 to its stated term.
- GHB CSV import reads paid rows only, requires the actual principal and interest
  columns, previews values and requires valid payment dates before saving. Blank
  dates are never replaced with an invented date. Existing GHB installment
  references cannot be imported twice into the same round.
- Actual principal = amount paid minus bank-reported interest. Fees are recorded
  separately. Loan schedules with recorded payments are immutable through the UI.
- A retention round carries the exact remaining principal from its predecessor.
  Payments must fall within their assigned round. Changes that would invalidate
  a later carried balance are rejected.
- Forecasts use monthly interest (`opening * annualRate / 1200`), fixed reference
  MRR and rounding to two decimals. They start at the beginning of the selected
  round and do not replace bank statements or forecast from actual payments.
  Incomplete payoff / negative amortization is displayed as remaining debt.
- Items, purchase price, BOQ and current valuation are kept separate to avoid
  counting the same property cost twice. Ledger references are text only; no
  automatic accounting entries or attachments are created in this first version.

## Checks

`npx tsx --test tests/asset.test.ts`

`npx eslint app/asset`

`npx tsc --noEmit --incremental false`
