import { ChangeSignal } from '../domain/ChangeSignal'
import type { Diagram } from '../domain/Diagram'
import type { ObservableStore } from '../domain/ObservableStore'
import type { ResourceImpact, Workspace } from '../domain/Workspace'

export type DeleteTarget = { kind: 'link' | 'placement' | 'resource'; id: string }

export type PendingDelete = { readonly counts: ResourceImpact; run(): void }

// Single path for deleting a selection, shared by the Delete key and the Inspector.
// Kept free of React so the confirm-before-delete rule is testable without a DOM.
export class DeleteFlow implements ObservableStore {
  private readonly signal = new ChangeSignal()
  private _pending: PendingDelete | null = null

  private readonly workspace: Workspace

  constructor(workspace: Workspace) {
    this.workspace = workspace
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  get pending(): PendingDelete | null {
    return this._pending
  }

  request(diagram: Diagram, target: DeleteTarget): void {
    switch (target.kind) {
      case 'link':
        diagram.removeLink(target.id)
        return
      case 'placement':
        // The Resource survives, so there is nothing to confirm.
        diagram.removePlacement(target.id)
        return
      case 'resource': {
        const counts = this.workspace.resourceImpact(target.id)
        this._pending = { counts, run: () => this.workspace.removeResource(target.id) }
        this.signal.notify()
        return
      }
    }
  }

  confirm(): void {
    const pending = this._pending
    if (!pending) return
    this._pending = null
    pending.run()
    this.signal.notify()
  }

  cancel(): void {
    if (!this._pending) return
    this._pending = null
    this.signal.notify()
  }
}
