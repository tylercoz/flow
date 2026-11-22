import { useApp } from './AppProvider'
import { CatalogDialog } from './CatalogDialog'
import { useStore } from './useStore'
export function EnvironmentVariablesDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useApp()
  useStore(workspace)
  return (
    <CatalogDialog
      title="Environment variables"
      noun="environment variable"
      entries={workspace.environmentVariables}
      usage={(id) => workspace.environmentVariableUsage(id)}
      onAdd={() => workspace.addEnvironmentVariable('')}
      onRename={(id, name) => workspace.renameEnvironmentVariable(id, name)}
      onRemove={(id) => workspace.removeEnvironmentVariable(id)}
      onClose={onClose}
    />
  )
}
