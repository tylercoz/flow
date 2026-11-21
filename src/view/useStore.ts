import { useSyncExternalStore } from 'react'
import type { ObservableStore } from '../domain/ObservableStore'

// Subscribing to the version makes the component re-render on every domain change,
// while callers keep reading the live (mutable) store object.
export function useStore<T extends ObservableStore>(store: T): T {
  useSyncExternalStore(store.subscribe, store.getVersion)
  return store
}
