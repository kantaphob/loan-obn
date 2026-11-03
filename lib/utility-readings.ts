/** Match a historical reading by home, service and exact meter, before the selected month. */
export function previousUtilityBill<T extends { id: number; homeId: number; kind: string; meter: string; period: string; currentReading: number }>(
  bills: T[], selection: { homeId: number; kind: string; meter: string; period: string; excludeId?: number },
): T | undefined {
  if (!selection.meter || !selection.period) return undefined
  return bills.filter(b => b.id !== selection.excludeId && b.homeId === selection.homeId && b.kind === selection.kind && b.meter === selection.meter && b.period < selection.period)
    .sort((a, b) => b.period.localeCompare(a.period) || b.id - a.id)[0]
}
