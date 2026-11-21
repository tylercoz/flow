import { ChangeSignal } from '../domain/ChangeSignal'
import type { Diagram } from '../domain/Diagram'
import type { ObservableStore } from '../domain/ObservableStore'

export type DeleteTarget = { kind: 'component' | 'link'; id: string }

export interface PendingDelete {
  readonly diagram: Diagram
  readonly componentId: string
  readonly contents: number
  readonly links: number
}

// Single path for deleting a selection, shared by the Delete key and the Inspector.
// Kept free of React so the confirm-before-delete rule is testable without a DOM.
export class DeleteFlow implements ObservableStore {
  private readonly signal = new ChangeSignal()
  private _pending: PendingDelete | null = null

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  get pending(): PendingDelete | null {
    return this._pending
  }

  request(diagram: Diagram, target: DeleteTarget): void {
    if (target.kind === 'link') {
      diagram.removeLink(target.id)
      return
    }
    const { contents, links } = diagram.deletionImpact(target.id)
    // Attached Links are cheap to redraw, so only losing nested work is worth an interruption.
    if (contents === 0) {
      diagram.removeComponent(target.id)
      return
    }
    this._pending = { diagram, componentId: target.id, contents, links }
    this.signal.notify()
  }

  confirm(): void {
    const pending = this._pending
    if (!pending) return
    this._pending = null
    pending.diagram.removeComponent(pending.componentId)
    this.signal.notify()
  }

  cancel(): void {
    if (!this._pending) return
    this._pending = null
    this.signal.notify()
  }
}
