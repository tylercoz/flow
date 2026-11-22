import { DomainError } from '../domain/DomainError'
import { useApp } from './AppProvider'
import { CatalogDialog } from './CatalogDialog'
import { useStore } from './useStore'
export function TypesDialog({ onClose }: { onClose: () => void }) {
  const { workspace, notifier } = useApp()
  useStore(workspace)
  const remove = (id: string) => {
    try {
      workspace.removeType(id)
    } catch (e) {
      if (!(e instanceof DomainError)) throw e
      notifier.post('types', e.message, 'transient')
    }
  }
  return (
    <CatalogDialog
      title="Types"
      noun="type"
      entries={workspace.types}
      onAdd={() => workspace.addType('')}
      onRename={(id, name) => workspace.renameType(id, name)}
      onRemove={remove}
      onClose={onClose}
    />
  )
}
