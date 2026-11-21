import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled rather than fetched from a font CDN so the local-first app renders the same offline.
import '@fontsource-variable/roboto-mono'
import './index.css'
import App from './App.tsx'
import { History } from './domain/History'
import { Navigator } from './domain/Navigator'
import { Notifier } from './domain/Notifier'
import { TimerScheduler } from './domain/Scheduler'
import { UuidGenerator } from './domain/IdGenerator'
import { AutoSaver } from './persistence/AutoSaver'
import { LocalStorageRepository } from './persistence/LocalStorageRepository'
import { WorkspaceLoader } from './persistence/WorkspaceLoader'
import { WorkspaceSerializer } from './persistence/WorkspaceSerializer'
import { AppProvider } from './view/AppProvider'

async function main() {
  const ids = new UuidGenerator()
  const scheduler = new TimerScheduler()
  const notifier = new Notifier(scheduler)
  const serializer = new WorkspaceSerializer()
  const repository = new LocalStorageRepository(window.localStorage)
  const { workspace, canSave } = await new WorkspaceLoader(repository, serializer, ids, notifier).load()
  const navigator = new Navigator(workspace)
  const history = new History(workspace, navigator)
  history.start()

  // Saving after a failed load would overwrite stored data the user may still recover (requirement 5.5).
  if (canSave) new AutoSaver(workspace, serializer, repository, notifier, scheduler).start()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider services={{ workspace, navigator, history, notifier, scheduler }}>
        <App />
      </AppProvider>
    </StrictMode>,
  )
}

// Only PersistenceError is handled (inside the loader); anything else is a bug and must surface.
main().catch((error: unknown) => {
  console.error(error)
  throw error
})
