import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

type CashActionsProps = {
  className?: string
} & (
  | { onIncome: () => void; onExpense: () => void; disabled?: boolean; incomeHref?: never; expenseHref?: never }
  | { incomeHref: string; expenseHref: string; onIncome?: never; onExpense?: never; disabled?: never }
)

/** Standard entry points for recording incoming and outgoing cash. */
export function CashActions(props: CashActionsProps) {
  return <div className={`cash-actions ${props.className ?? ''}`} role="group" aria-label="บันทึกรับ–จ่าย">
    {props.incomeHref !== undefined ? <Link href={props.incomeHref} className="cash-action cash-action--income"><ArrowDownLeft size={18} aria-hidden="true" />บันทึกรายรับ</Link> : <button type="button" className="cash-action cash-action--income" disabled={props.disabled} onClick={props.onIncome}><ArrowDownLeft size={18} aria-hidden="true" />บันทึกรายรับ</button>}
    {props.expenseHref !== undefined ? <Link href={props.expenseHref} className="cash-action cash-action--expense"><ArrowUpRight size={18} aria-hidden="true" />บันทึกรายจ่าย</Link> : <button type="button" className="cash-action cash-action--expense" disabled={props.disabled} onClick={props.onExpense}><ArrowUpRight size={18} aria-hidden="true" />บันทึกรายจ่าย</button>}
  </div>
}
