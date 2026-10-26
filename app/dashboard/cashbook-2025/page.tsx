import { redirect } from 'next/navigation'

export default async function Cashbook2025({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams({ year: '2025' })
  for (const key of ['q', 'direction', 'month', 'page']) {
    const value = params[key]
    if (typeof value === 'string' && value) query.set(key, value)
  }
  redirect(`/dashboard/ledger?${query}`)
}
