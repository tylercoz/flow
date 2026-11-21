export type TimerHandle = ReturnType<typeof setTimeout>

// Lets Notifier and AutoSaver run against a fake clock in tests.
export interface Scheduler {
  set(fn: () => void, ms: number): TimerHandle
  cancel(handle: TimerHandle): void
}

export class TimerScheduler implements Scheduler {
  set(fn: () => void, ms: number): TimerHandle {
    return setTimeout(fn, ms)
  }

  cancel(handle: TimerHandle): void {
    clearTimeout(handle)
  }
}
