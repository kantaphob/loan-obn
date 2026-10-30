# CashActions

Shared entry points for general cash receipts and expenses. Used in Property and the ledger, including the combined-year view. The component only opens a form or navigates; saving belongs to the caller.

```tsx
import { CashActions } from '@/components/ui/cash-actions'

<CashActions onIncome={() => open('IN')} onExpense={() => open('OUT')} disabled={saving} />

<CashActions incomeHref="/dashboard/ledger?create=1&direction=IN" expenseHref="/dashboard/ledger?create=1&direction=OUT" />
```

- Receipt: green, inward arrow, label `บันทึกรายรับ`.
- Expense: rose, outward arrow, label `บันทึกรายจ่าย`.
- Minimum height 44px, 14px labels, 18px decorative icons, wrapping layout.
- Uses semantic buttons for actions and links for navigation. Buttons are always `type="button"`.
- Supports keyboard focus, hover and disabled states. Disable during save. Labels and arrow direction convey meaning without relying on color alone.
- Shared `--cash-*` colors and styles live in `app/globals.css`; do not copy page-local button CSS or override labels/colors at call sites.
- `className` applies to the containing group for placement. The action and link prop modes are mutually exclusive.
