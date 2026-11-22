// A Component lists each catalog entry (exception, environment variable) at most once, so the add control offers only those not yet listed.
export function availableEntries<T extends { id: string }>(catalog: readonly T[], used: readonly string[]): T[] {
  return catalog.filter((e) => !used.includes(e.id))
}
