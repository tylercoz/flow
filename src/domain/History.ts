import { ChangeSignal } from './ChangeSignal'
import type { ObservableStore } from './ObservableStore'

export type Snapshot = string // opaque; produced and consumed only by Restorable

// Narrow view of the Workspace so tests can use a fake.
export interface Restorable extends ObservableStore {
  capture(): Snapshot
  replaceContent(snapshot: Snapshot): void
}

const HISTORY_LIMIT = 100

export class History implements ObservableStore {
  private readonly signal = new ChangeSignal()
  private readonly undoStack: Snapshot[] = []
  private readonly redoStack: Snapshot[] = []
  private baseline: Snapshot
  // Set during a restore so the Workspace's own notification is not recorded as a new step.
  private applying = false
  private grouping = false
  private started = false

  private readonly workspace: Restorable
  private readonly levels: { reconcile(): void }
  private readonly limit: number

  constructor(
    workspace: Restorable,
    levels: { reconcile(): void },
    limit: number = HISTORY_LIMIT,
  ) {
    this.workspace = workspace
    this.levels = levels
    this.limit = limit
    this.baseline = workspace.capture()
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.baseline = this.workspace.capture()
    this.workspace.subscribe(this.onWorkspaceChange)
  }

  // A flag, not a counter, so a missed or doubled call cannot leave the group stuck.
  beginGroup(): void {
    this.grouping = true
  }

  endGroup(): void {
    if (!this.grouping) return
    this.grouping = false
    this.recordIfChanged()
  }

  undo(): void {
    this.step(this.undoStack, this.redoStack)
  }

  redo(): void {
    this.step(this.redoStack, this.undoStack)
  }

  private onWorkspaceChange = (): void => {
    if (this.applying || this.grouping) return
    this.recordIfChanged()
  }

  private recordIfChanged(): void {
    const next = this.workspace.capture()
    if (next === this.baseline) return
    this.push(this.undoStack, this.baseline)
    this.redoStack.length = 0
    this.baseline = next
    this.signal.notify()
  }

  private step(from: Snapshot[], to: Snapshot[]): void {
    this.endGroup()
    const target = from.pop()
    if (target === undefined) return
    this.push(to, this.workspace.capture())
    this.applying = true
    try {
      this.workspace.replaceContent(target)
    } finally {
      this.applying = false
    }
    this.baseline = target
    this.levels.reconcile()
    this.signal.notify()
  }

  private push(stack: Snapshot[], snapshot: Snapshot): void {
    stack.push(snapshot)
    if (stack.length > this.limit) stack.shift()
  }
}
