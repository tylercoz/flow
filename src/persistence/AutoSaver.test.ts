import { describe, expect, it } from 'vitest'
import { History } from '../domain/History'
import { Navigator } from '../domain/Navigator'
import { Notifier } from '../domain/Notifier'
import type { Scheduler, TimerHandle } from '../domain/Scheduler'
import type { WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import { Workspace } from '../domain/Workspace'
import { AutoSaver } from './AutoSaver'
import { PersistenceError } from './PersistenceError'
import type { Repository } from './Repository'
import { WorkspaceSerializer } from './WorkspaceSerializer'

class FakeScheduler implements Scheduler {
  now = 0
  private nextId = 1
  private timers = new Map<number, { at: number; fn: () => void }>()

  set(fn: () => void, ms: number): TimerHandle {
    const id = this.nextId++
    this.timers.set(id, { at: this.now + ms, fn })
    return id as unknown as TimerHandle
  }

  cancel(handle: TimerHandle): void {
    this.timers.delete(handle as unknown as number)
  }

  get pending(): number {
    return this.timers.size
  }

  // Fires due timers in time order, moving the clock to each one.
  advance(ms: number): void {
    const end = this.now + ms
    for (;;) {
      const due = [...this.timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      this.timers.delete(due[0])
      this.now = due[1].at
      due[1].fn()
    }
    this.now = end
  }
}

class FakeRepository implements Repository {
  saves: WorkspaceSnapshot[] = []
  failing = false

  load(): Promise<unknown | null> {
    return Promise.resolve(null)
  }

  save(snapshot: WorkspaceSnapshot): Promise<void> {
    if (this.failing) return Promise.reject(new PersistenceError('quota'))
    this.saves.push(snapshot)
    return Promise.resolve()
  }
}

// Lets the save queue's promise chain run; no timers involved.
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function setup() {
  let n = 0
  const workspace = Workspace.empty({ next: () => `id${++n}` })
  const scheduler = new FakeScheduler()
  const repository = new FakeRepository()
  const notifier = new Notifier(scheduler)
  const pageEvents = new EventTarget()
  const saver = new AutoSaver(workspace, new WorkspaceSerializer(), repository, notifier, scheduler, pageEvents)
  saver.start()
  const edit = () => workspace.root.addComponent({ x: 0, y: 0 })
  const saveMessage = () => notifier.messages.find((m) => m.key === 'save')
  return { workspace, scheduler, repository, notifier, pageEvents, saver, edit, saveMessage }
}

describe('AutoSaver', () => {
  it('saves 500 ms after a change, not before', async () => {
    const { scheduler, repository, edit } = setup()
    edit()
    scheduler.advance(499)
    await settle()
    expect(repository.saves).toHaveLength(0)
    scheduler.advance(1)
    await settle()
    expect(repository.saves).toHaveLength(1)
  })

  it('coalesces a burst of changes into one save of the latest state', async () => {
    const { scheduler, repository, edit } = setup()
    edit()
    scheduler.advance(300)
    edit()
    scheduler.advance(300)
    edit()
    scheduler.advance(500)
    await settle()
    expect(repository.saves).toHaveLength(1)
    expect(repository.saves[0].root.components).toHaveLength(3)
  })

  it('saves after 900 ms of continuous editing even though the debounce keeps resetting', async () => {
    const { scheduler, repository, edit } = setup()
    for (let t = 0; t < 900; t += 400) {
      edit()
      scheduler.advance(400)
    }
    await settle()
    // The third edit was at 800 ms; its debounce would only fire at 1300 ms.
    expect(repository.saves).toHaveLength(1)
    expect(scheduler.now).toBe(1200)
  })

  it('does not save before the 900 ms max wait while edits keep arriving', async () => {
    const { scheduler, repository, edit } = setup()
    edit()
    scheduler.advance(400)
    edit()
    scheduler.advance(499)
    await settle()
    expect(repository.saves).toHaveLength(0)
    scheduler.advance(1)
    await settle()
    expect(repository.saves).toHaveLength(1)
  })

  it('posts a persistent save message on failure and clears it after a later success', async () => {
    const { scheduler, repository, edit, saveMessage } = setup()
    repository.failing = true
    edit()
    scheduler.advance(500)
    await settle()
    expect(saveMessage()?.kind).toBe('persistent')

    // Persistent messages do not auto-dismiss.
    scheduler.advance(60_000)
    expect(saveMessage()).toBeDefined()

    repository.failing = false
    edit()
    scheduler.advance(500)
    await settle()
    expect(repository.saves).toHaveLength(1)
    expect(saveMessage()).toBeUndefined()
  })

  it('retries the unsaved state on the next change', async () => {
    const { scheduler, repository, edit } = setup()
    repository.failing = true
    edit()
    scheduler.advance(500)
    await settle()
    repository.failing = false
    edit()
    scheduler.advance(500)
    await settle()
    expect(repository.saves[0].root.components).toHaveLength(2)
  })

  it('flushes a pending change immediately on pagehide', async () => {
    const { scheduler, repository, pageEvents, edit } = setup()
    edit()
    pageEvents.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(repository.saves).toHaveLength(1)
    // The pending timers were cancelled, so no second save follows.
    scheduler.advance(2000)
    await settle()
    expect(repository.saves).toHaveLength(1)
  })

  it('retries a failed save on pagehide', async () => {
    const { scheduler, repository, pageEvents, edit, saveMessage } = setup()
    repository.failing = true
    edit()
    scheduler.advance(500)
    await settle()
    repository.failing = false
    pageEvents.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(repository.saves).toHaveLength(1)
    expect(saveMessage()).toBeUndefined()
  })

  it('does not save on pagehide when nothing changed', async () => {
    const { repository, pageEvents } = setup()
    pageEvents.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(repository.saves).toHaveLength(0)
  })

  it('saves the restored content after an undo', async () => {
    const { workspace, scheduler, repository, edit } = setup()
    const history = new History(workspace, new Navigator(workspace))
    history.start()
    edit()
    scheduler.advance(500)
    await settle()
    expect(repository.saves.at(-1)?.root.components).toHaveLength(1)

    history.undo()
    scheduler.advance(500)
    await settle()
    expect(repository.saves).toHaveLength(2)
    expect(repository.saves[1].root.components).toHaveLength(0)
  })

  it('stop() cancels pending timers and ignores later changes and pagehide', async () => {
    const { scheduler, repository, pageEvents, saver, edit } = setup()
    edit()
    saver.stop()
    expect(scheduler.pending).toBe(0)
    edit()
    pageEvents.dispatchEvent(new Event('pagehide'))
    scheduler.advance(2000)
    await settle()
    expect(repository.saves).toHaveLength(0)
    expect(scheduler.pending).toBe(0)
  })
})
