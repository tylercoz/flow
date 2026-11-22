import { describe, expect, it, vi } from 'vitest'
import { ChangeSignal } from './ChangeSignal'
import { DEFAULT_VIEWPORT } from './Viewport'
import { DomainError } from './DomainError'
import { TimerScheduler } from './Scheduler'
import { UuidGenerator } from './IdGenerator'

describe('ChangeSignal', () => {
  it('bumps the version and calls listeners until unsubscribed', () => {
    const signal = new ChangeSignal()
    const listener = vi.fn()
    const unsubscribe = signal.subscribe(listener)
    signal.notify()
    unsubscribe()
    signal.notify()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(signal.getVersion()).toBe(2)
  })
})


describe('other primitives', () => {
  it('defaults the viewport to origin at zoom 1', () => {
    expect(DEFAULT_VIEWPORT).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('carries a code on DomainError', () => {
    const error = new DomainError('SELF_LINK', 'x')
    expect(error.code).toBe('SELF_LINK')
    expect(error).toBeInstanceOf(Error)
  })

  it('generates distinct ids', () => {
    const ids = new UuidGenerator()
    expect(ids.next()).not.toBe(ids.next())
  })

  it('cancels a scheduled callback', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const scheduler = new TimerScheduler()
    scheduler.cancel(scheduler.set(fn, 10))
    scheduler.set(fn, 10)
    vi.advanceTimersByTime(10)
    vi.useRealTimers()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
