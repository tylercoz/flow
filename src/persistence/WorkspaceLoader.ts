import type { IdGenerator } from '../domain/IdGenerator'
import type { Notifier } from '../domain/Notifier'
import { Workspace } from '../domain/Workspace'
import { PersistenceError } from './PersistenceError'
import type { Repository } from './Repository'
import type { WorkspaceSerializer } from './WorkspaceSerializer'

export interface LoadResult {
  readonly workspace: Workspace
  readonly canSave: boolean
}

export class WorkspaceLoader {
  private readonly repository: Repository
  private readonly serializer: WorkspaceSerializer
  private readonly ids: IdGenerator
  private readonly notifier: Notifier

  constructor(repository: Repository, serializer: WorkspaceSerializer, ids: IdGenerator, notifier: Notifier) {
    this.repository = repository
    this.serializer = serializer
    this.ids = ids
    this.notifier = notifier
  }

  async load(): Promise<LoadResult> {
    try {
      const raw = await this.repository.load()
      if (raw === null) return { workspace: Workspace.empty(this.ids), canSave: true }
      const workspace = Workspace.restore(this.serializer.deserialize(raw), this.ids)
      return { workspace, canSave: true }
    } catch (e) {
      if (!(e instanceof PersistenceError)) throw e
      // canSave stays false so the caller never autosaves over data we could not read.
      this.notifier.post('load', 'Saved data could not be read. Starting empty; changes will not be saved.', 'persistent')
      return { workspace: Workspace.empty(this.ids), canSave: false }
    }
  }
}
