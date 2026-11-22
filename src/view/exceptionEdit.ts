import type { ExceptionType } from '../domain/ExceptionType'

// A Component lists each exception at most once, so the add control offers only those not yet listed.
export function availableExceptions(catalog: readonly ExceptionType[], used: readonly string[]): ExceptionType[] {
  return catalog.filter((e) => !used.includes(e.id))
}
