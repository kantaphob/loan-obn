import { PendingDisbursements, type Params } from '../invoice/pending-disbursements'

export default function PayablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  return <PendingDisbursements searchParams={searchParams} basePath="/dashboard/ap" />
}
