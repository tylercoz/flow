import { describe, expect, it } from 'vitest'
import { Notifier } from './Notifier'
import type { Scheduler, TimerHandle } from './Scheduler'

class FakeScheduler implements Scheduler {
  private now = 0
  private nextId = 1
  private readonly timers = new Map<number, { at: number; fn: () => void }>()

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
    for (const [id, t] of [...this.timers]) {
      if (t.at <= this.now && this.timers.delete(id)) t.fn()
    }
  }
}

function setup() {
  const scheduler = new FakeScheduler()
  const notifier = new Notifier(scheduler)
  let notifications = 0
  notifier.subscribe(() => notifications++)
  return { scheduler, notifier, count: () => notifications }
}

describe('Notifier', () => {
  it('auto-dismisses a transient message after 5000 ms', () => {
    const { scheduler, notifier } = setup()
    notifier.post('a', 'hi', 'transient')
    scheduler.advance(4999)
    expect(notifier.messages).toHaveLength(1)
    scheduler.advance(1)
    expect(notifier.messages).toEqual([])
  })

  it('keeps a persistent message indefinitely', () => {
    const { scheduler, notifier } = setup()
    notifier.post('a', 'hi', 'persistent')
    scheduler.advance(1_000_000)
    expect(notifier.messages).toEqual([{ key: 'a', text: 'hi', kind: 'persistent' }])
  })

  it('replacing by key restarts the timer and the old timer does not clear the new message', () => {
    const { scheduler, notifier } = setup()
    notifier.post('a', 'first', 'transient')
    scheduler.advance(3000)
    notifier.post('a', 'second', 'transient')
    scheduler.advance(3000)
    expect(notifier.messages).toEqual([{ key: 'a', text: 'second', kind: 'transient' }])
    scheduler.advance(2000)
    expect(notifier.messages).toEqual([])
  })

  it('replacing a transient message with a persistent one cancels the timer', () => {
    const { scheduler, notifier } = setup()
    notifier.post('a', 'first', 'transient')
    notifier.post('a', 'second', 'persistent')
    scheduler.advance(10_000)
    expect(notifier.messages).toHaveLength(1)
  })

  it('clear(key) removes only that message', () => {
    const { notifier } = setup()
    notifier.post('a', 'A', 'persistent')
    notifier.post('b', 'B', 'persistent')
    notifier.clear('a')
    expect(notifier.messages.map((m) => m.key)).toEqual(['b'])
  })

  it('clearing an absent key does not notify', () => {
    const { notifier, count } = setup()
    const before = notifier.messages
    notifier.clear('missing')
    expect(count()).toBe(0)
    expect(notifier.messages).toBe(before)
  })

  it('exposes a new messages array reference and notifies on every change', () => {
    const { scheduler, notifier, count } = setup()
    const empty = notifier.messages
    notifier.post('a', 'A', 'transient')
    const afterPost = notifier.messages
    expect(afterPost).not.toBe(empty)
    notifier.post('a', 'A2', 'transient')
    const afterReplace = notifier.messages
    expect(afterReplace).not.toBe(afterPost)
    scheduler.advance(5000)
    expect(notifier.messages).not.toBe(afterReplace)
    expect(count()).toBe(3)
  })
})
