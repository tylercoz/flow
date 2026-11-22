import { ChangeSignal } from '../domain/ChangeSignal'
import type { ObservableStore } from '../domain/ObservableStore'
import type { Scheduler, TimerHandle } from '../domain/Scheduler'

export const RENAME_DELAY_MS = 300

// Delays the start of Rename so a double-click can cancel it, and holds which Placement or Link is being renamed.
export class RenameController implements ObservableStore {
  private readonly signal = new ChangeSignal()
  private pending: TimerHandle | undefined
  private editing: string | undefined

  private readonly scheduler: Scheduler

  constructor(scheduler: Scheduler) {
    this.scheduler = scheduler
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  get editingId(): string | undefined {
    return this.editing
  }

  schedule(componentId: string): void {
    this.cancel()
    this.pending = this.scheduler.set(() => this.start(componentId), RENAME_DELAY_MS)
  }

  // Starts Rename immediately; dropping a pending start keeps a late timer from re-targeting the editor.
  start(componentId: string): void {
    this.cancel()
    this.editing = componentId
    this.signal.notify()
  }

  // Drops only the pending start; an active Rename ends through the input.
  cancel(): void {
    if (this.pending === undefined) return
    this.scheduler.cancel(this.pending)
    this.pending = undefined
  }

  end(): void {
    if (this.editing === undefined) return
    this.editing = undefined
    this.signal.notify()
  }
}
