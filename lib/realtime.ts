export type LoanApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_DOCUMENTS'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'

export type LoanStatusChangedEvent = {
  type: 'loan.status.changed'
  applicationNumber: string
  status: LoanApplicationStatus
  changedAt: string
}

export type CreditBureauChangedEvent = {
  type: 'credit-bureau.changed'
  changedAt: string
}

export type RealtimeEvent = LoanStatusChangedEvent | CreditBureauChangedEvent

type NotificationHub = {
  publish: (event: RealtimeEvent) => void
}

declare global {
  // Set by server.mjs. Keeping the transport on globalThis lets Next route handlers
  // publish to the same WebSocket server without opening a second listener.
  var __loanNotificationHub: NotificationHub | undefined
}

export function publishLoanStatusChanged(
  applicationNumber: string,
  status: LoanApplicationStatus,
) {
  globalThis.__loanNotificationHub?.publish({
    type: 'loan.status.changed',
    applicationNumber,
    status,
    changedAt: new Date().toISOString(),
  })
}

export function publishCreditBureauChanged() {
  globalThis.__loanNotificationHub?.publish({
    type: 'credit-bureau.changed',
    changedAt: new Date().toISOString(),
  })
}
