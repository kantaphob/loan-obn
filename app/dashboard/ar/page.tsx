import { redirect } from 'next/navigation'

// This compatibility route redirects after reading request-time filters.
export const instant = false

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  if (typeof params.q === 'string') query.set('q', params.q.slice(0, 100))
  if (typeof params.view === 'string') query.set('view', params.view === 'ALL' ? 'OPEN' : params.view)
  if (typeof params.page === 'string') query.set('page', params.page)
  redirect(`/dashboard/repayments${query.size ? `?${query}` : ''}`)
}
