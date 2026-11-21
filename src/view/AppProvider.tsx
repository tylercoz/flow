import { createContext, useContext, type ReactNode } from 'react'
import type { Navigator } from '../domain/Navigator'
import type { Notifier } from '../domain/Notifier'
import type { Workspace } from '../domain/Workspace'

export interface AppServices {
  workspace: Workspace
  navigator: Navigator
  notifier: Notifier
}

const AppContext = createContext<AppServices | null>(null)

export function AppProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <AppContext.Provider value={services}>{children}</AppContext.Provider>
}

export function useApp(): AppServices {
  const services = useContext(AppContext)
  // A missing provider is a wiring bug in the composition root, not a runtime condition.
  if (!services) throw new Error('useApp must be used inside AppProvider')
  return services
}
