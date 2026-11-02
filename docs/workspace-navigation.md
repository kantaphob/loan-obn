# Workspace navigation

The navigation is defined once in `lib/nav.ts`. Existing data pages keep their URLs, queries, forms, permissions, and database actions. The shared shell organizes them into work areas instead of exposing implementation names as menu groups.

| Work area | Entry page | Purpose |
| --- | --- | --- |
| ภาพรวม | `/dashboard` | Business totals and today's follow-ups |
| การเงิน | `/dashboard/workspace/finance` | Cash ledger, receivables, reimbursements, payroll, recurring items |
| สินเชื่อ | `/dashboard/workspace/loans` | Borrowers, credit, contracts, disbursement, repayments, capital |
| ทรัพย์สินและหนี้สิน | `/dashboard/workspace/assets` | Property, assets, liabilities, deleted items |
| คู่ค้าและผู้ให้ทุน | `/dashboard/workspace/partners` | Lenders, persuaders, shares |
| รายงานและปิดบัญชี | `/dashboard/workspace/reports` | Analytics, accounting reports, closing |
| ตั้งค่าระบบ | `/dashboard/workspace/system` | Users, master data, audit logs, backups |

`/dashboard/workspace` lists every work area. Group pages contain navigation only, with no invented business metrics or new data writes.

## Shared components

- `Sidebar`: shows work areas, opens the current area's pages, supports a compact desktop rail and a mobile disclosure overlay.
- `WorkspaceBar`: resolves breadcrumbs from the registry and searches Thai labels, English aliases, descriptions, and child pages. Cmd/Ctrl+K focuses search; arrow keys select results; Escape dismisses it.
- `WorkspaceSectionNav`: horizontal links to related pages, with the active page brought into view on narrow screens.
- `WorkspaceDirectory`: renders the group directory and each group's tool cards from the same registry.
- `PageContainer`: supplies the same content insets used by the loading UI and real pages.
- `workspace-structure.css`: controls shared shell and directory layout, preserving the existing theme variables and page-specific forms and tables.

## Adding a destination

1. Add a `NavItem` under exactly one group in `NAV_GROUPS`, with a Thai label, description, and optional English keywords.
2. For child tools that should be searchable without expanding the main menu, add a `NAV_CHILD_PAGES` entry with its parent URL.
3. Run `node --import tsx --test tests/navigation.test.ts` to check destinations, group selection, legacy links, and search.
4. Keep authorization on the destination page and server actions. Menu visibility does not grant access.

Legacy cashbook, receivables, and invoice URLs retain their existing redirects and filters. Matching navigation aliases select the corresponding current page.
