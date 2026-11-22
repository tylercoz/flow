import type { EnvironmentVariable } from '../domain/EnvironmentVariable'
// A Component lists each environment variable at most once, so the add control offers only those not yet listed.
export function availableEnvironmentVariables(catalog: readonly EnvironmentVariable[], used: readonly string[]): EnvironmentVariable[] {
  return catalog.filter((v) => !used.includes(v.id))
}
