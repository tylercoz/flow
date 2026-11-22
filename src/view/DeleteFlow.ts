import { ChangeSignal } from '../domain/ChangeSignal'
import type { Diagram } from '../domain/Diagram'
import type { ObservableStore } from '../domain/ObservableStore'
import type { Workspace } from '../domain/Workspace'

export type DeleteTarget = { kind: 'component' | 'link' | 'placement' | 'resource'; id: string }

export type PendingDelete =
  | { readonly subject: 'component'; readonly counts: { contents: number; links: number }; run(): void }
  | { readonly subject: 'resource'; readonly counts: { placements: number; links: number }; run(): void }

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
        this._pending = { subject: 'resource', counts, run: () => this.workspace.removeResource(target.id) }
        this.signal.notify()
        return
      }
      case 'component': {
        const counts = diagram.deletionImpact(target.id)
        // Attached Links are cheap to redraw, so only losing nested work is worth an interruption.
        if (counts.contents === 0) {
          diagram.removeComponent(target.id)
          return
        }
        this._pending = { subject: 'component', counts, run: () => diagram.removeComponent(target.id) }
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
