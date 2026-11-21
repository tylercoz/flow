import type { Notifier } from '../domain/Notifier'
import type { Scheduler, TimerHandle } from '../domain/Scheduler'
import type { Workspace } from '../domain/Workspace'
import { PersistenceError } from './PersistenceError'
import type { Repository } from './Repository'
import type { WorkspaceSerializer } from './WorkspaceSerializer'

const DEBOUNCE_MS = 500
// Keeps continuous editing inside the 1 s save requirement (5.1).
const MAX_WAIT_MS = 900
const SAVE_KEY = 'save'

export class AutoSaver {
  private unsubscribe: (() => void) | undefined
  private debounceTimer: TimerHandle | undefined
  private maxWaitTimer: TimerHandle | undefined
  // Stays true after a failed save so `flush` (pagehide) retries it.
  private dirty = false
  // Serializes saves so a slow earlier write cannot overwrite a newer one.
  private queue: Promise<void> = Promise.resolve()

  private readonly onPageHide = (): void => {
    void this.flush()
  }

  private readonly workspace: Workspace
  private readonly serializer: WorkspaceSerializer
  private readonly repository: Repository
  private readonly notifier: Notifier
  private readonly scheduler: Scheduler
  private readonly pageEvents: EventTarget | undefined

  constructor(
    workspace: Workspace,
    serializer: WorkspaceSerializer,
    repository: Repository,
    notifier: Notifier,
    scheduler: Scheduler,
    // Undefined outside a browser, where there is no pagehide to listen for.
    pageEvents: EventTarget | undefined = globalThis.window,
  ) {
    this.workspace = workspace
    this.serializer = serializer
    this.repository = repository
    this.notifier = notifier
    this.scheduler = scheduler
    this.pageEvents = pageEvents
  }

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.workspace.subscribe(() => this.onChange())
    this.pageEvents?.addEventListener('pagehide', this.onPageHide)
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.pageEvents?.removeEventListener('pagehide', this.onPageHide)
    this.cancelTimers()
  }

  flush(): Promise<void> {
    this.cancelTimers()
    if (!this.dirty) return this.queue
    this.queue = this.queue.then(() => this.save())
    return this.queue
  }

  private onChange(): void {
    this.dirty = true
    if (this.debounceTimer !== undefined) this.scheduler.cancel(this.debounceTimer)
    this.debounceTimer = this.scheduler.set(() => void this.flush(), DEBOUNCE_MS)
    // Only the first change of a burst arms the max-wait timer, so it is not pushed back.
    this.maxWaitTimer ??= this.scheduler.set(() => void this.flush(), MAX_WAIT_MS)
  }

  private cancelTimers(): void {
    if (this.debounceTimer !== undefined) this.scheduler.cancel(this.debounceTimer)
    if (this.maxWaitTimer !== undefined) this.scheduler.cancel(this.maxWaitTimer)
    this.debounceTimer = undefined
    this.maxWaitTimer = undefined
  }

  private async save(): Promise<void> {
    // Snapshot at write time so queued saves persist the latest state.
    this.dirty = false
    try {
      await this.repository.save(this.serializer.serialize(this.workspace))
      this.notifier.clear(SAVE_KEY)
    } catch (e) {
      if (!(e instanceof PersistenceError)) throw e
      this.dirty = true
      this.notifier.post(SAVE_KEY, 'Changes are not saved. Saving will be retried on your next change.', 'persistent')
    }
  }
}
