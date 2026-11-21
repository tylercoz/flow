import type { WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import { PersistenceError } from './PersistenceError'
import type { Repository } from './Repository'

export const STORAGE_KEY = 'flow.workspace'

export class LocalStorageRepository implements Repository {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  async load(): Promise<unknown | null> {
    let text: string | null
    try {
      text = this.storage.getItem(STORAGE_KEY)
    } catch (cause) {
      // getItem throws when storage is disabled or blocked.
      throw new PersistenceError('Could not read stored workspace', { cause })
    }
    if (text === null) return null
    try {
      return JSON.parse(text)
    } catch (cause) {
      throw new PersistenceError('Stored workspace is not valid JSON', { cause })
    }
  }

  async save(snapshot: WorkspaceSnapshot): Promise<void> {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch (cause) {
      // setItem throws QuotaExceededError when storage is full.
      throw new PersistenceError('Could not save workspace', { cause })
    }
  }
}
