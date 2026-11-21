import { describe, expect, it } from 'vitest'
import type { Scheduler, TimerHandle } from '../domain/Scheduler'
import { RENAME_DELAY_MS, RenameController } from './RenameController'

class FakeScheduler implements Scheduler {
  private now = 0
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

  advance(ms: number): void {
    this.now += ms
    for (const [id, timer] of [...this.timers]) {
      if (timer.at <= this.now) {
        this.timers.delete(id)
        timer.fn()
      }
    }
  }
}

function setup() {
  const scheduler = new FakeScheduler()
  return { scheduler, rename: new RenameController(scheduler) }
}

describe('RenameController.start', () => {
  it('sets editingId and notifies subscribers', () => {
    const { rename } = setup()
    let notifications = 0
    rename.subscribe(() => notifications++)

    rename.start('a')

    expect(rename.editingId).toBe('a')
    expect(notifications).toBe(1)
  })

  it('drops a pending schedule so the late timer does not re-target the editor', () => {
    const { scheduler, rename } = setup()

    rename.schedule('a')
    rename.start('b')
    scheduler.advance(RENAME_DELAY_MS)

    expect(rename.editingId).toBe('b')
  })

  it('schedule still starts Rename after the delay', () => {
    const { scheduler, rename } = setup()

    rename.schedule('a')
    scheduler.advance(RENAME_DELAY_MS - 1)
    expect(rename.editingId).toBeUndefined()
    scheduler.advance(1)

    expect(rename.editingId).toBe('a')
  })

  it('cancel after start leaves editingId unchanged', () => {
    const { rename } = setup()

    rename.start('a')
    rename.cancel()

    expect(rename.editingId).toBe('a')
  })
})
