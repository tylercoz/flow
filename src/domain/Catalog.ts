import type { IdGenerator } from './IdGenerator'

export type CatalogEntry = { id: string; name: string }

// Silent on purpose: the owner notifies once per operation, so History records one undo step each.
export class Catalog<T extends CatalogEntry = CatalogEntry> {
  // Replaced, never mutated, so readers holding `all` see a stable snapshot.
  private entries: readonly T[]
  private readonly ids: IdGenerator

  constructor(ids: IdGenerator, entries: readonly T[] = []) {
    this.ids = ids
    this.entries = entries.map((e) => ({ ...e }))
  }

  get all(): readonly T[] {
    return this.entries
  }
  has(id: string): boolean {
    return this.entries.some((e) => e.id === id)
  }
  add(name: string): T {
    const entry = { id: this.ids.next(), name } as T
    this.entries = [...this.entries, entry]
    return entry
  }
  rename(id: string, name: string): void {
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, name } : e))
  }
  remove(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id)
  }
  replace(entries: readonly T[]): void {
    this.entries = entries.map((e) => ({ ...e }))
  }
}
