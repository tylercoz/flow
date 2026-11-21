import type { ObservableStore } from './ObservableStore'

// Composed by stores so React's useSyncExternalStore sees a new version after every notify.
export class ChangeSignal implements ObservableStore {
  private listeners = new Set<() => void>()
  private version = 0

  // Arrow properties keep `this` bound when passed straight to useSyncExternalStore.
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getVersion = (): number => this.version

  notify(): void {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}
