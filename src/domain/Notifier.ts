import { ChangeSignal } from './ChangeSignal'
import type { ObservableStore } from './ObservableStore'
import type { Scheduler, TimerHandle } from './Scheduler'

type MessageKind = 'transient' | 'persistent'

interface Message {
  readonly key: string
  readonly text: string
  readonly kind: MessageKind
}

export class Notifier implements ObservableStore {
  private readonly signal = new ChangeSignal()
  // Map keeps insertion order, and re-setting an existing key keeps its position.
  private readonly entries = new Map<string, Message>()
  private readonly timers = new Map<string, TimerHandle>()
  private _messages: readonly Message[] = []
  private readonly scheduler: Scheduler
  private readonly transientMs: number

  constructor(scheduler: Scheduler, transientMs = 5000) {
    this.scheduler = scheduler
    this.transientMs = transientMs
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  // Replaced on every change so React sees a new reference.
  get messages(): readonly Message[] {
    return this._messages
  }

  post(key: string, text: string, kind: MessageKind): void {
    // A replaced transient timer must not clear its successor.
    this.cancelTimer(key)
    this.entries.set(key, { key, text, kind })
    if (kind === 'transient') {
      this.timers.set(key, this.scheduler.set(() => this.clear(key), this.transientMs))
    }
    this.changed()
  }

  clear(key: string): void {
    this.cancelTimer(key)
    if (this.entries.delete(key)) this.changed()
  }

  private cancelTimer(key: string): void {
    const handle = this.timers.get(key)
    if (handle === undefined) return
    this.scheduler.cancel(handle)
    this.timers.delete(key)
  }

  private changed(): void {
    this._messages = [...this.entries.values()]
    this.signal.notify()
  }
}
