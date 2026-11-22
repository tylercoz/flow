import { useApp } from './AppProvider'
import { CatalogDialog } from './CatalogDialog'
import { useStore } from './useStore'
export function ExceptionsDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useApp()
  useStore(workspace)
  return (
    <CatalogDialog
      title="Exceptions"
      noun="exception"
      entries={workspace.exceptions}
      usage={(id) => workspace.exceptionUsage(id)}
      onAdd={() => workspace.addException('')}
      onRename={(id, name) => workspace.renameException(id, name)}
      onRemove={(id) => workspace.removeException(id)}
      onClose={onClose}
    />
  )
}
