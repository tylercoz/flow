import type { WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'

// Async so IndexedDB can replace localStorage without changing callers.
export interface Repository {
  /** Raw parsed data, or `null` when nothing is stored. Throws `PersistenceError` on failure. */
  load(): Promise<unknown | null>
  /** Throws `PersistenceError` on failure. */
  save(snapshot: WorkspaceSnapshot): Promise<void>
}
