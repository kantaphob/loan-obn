import { redirect } from 'next/navigation'

export default async function InvoicePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  if (typeof params.q === 'string') query.set('q', params.q.slice(0, 100))
  if (typeof params.period === 'string') query.set('period', params.period)
  redirect(`/dashboard/ap${query.size ? `?${query}` : ''}`)
}
