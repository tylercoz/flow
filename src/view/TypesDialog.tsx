import { DomainError } from '../domain/DomainError'
import { useApp } from './AppProvider'
import { FocusGroup } from './FocusGroup'
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
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Types">
        <FocusGroup className="dialog-fields">
          {workspace.types.map((type, i) => (
            <div className="field-row" key={type.id}>
              <input type="text" aria-label={`Type ${i + 1} name`} value={type.name} onChange={(e) => workspace.renameType(type.id, e.target.value)} />
              <button type="button" aria-label={`Remove type ${i + 1}`} onClick={() => remove(type.id)}>
                ×
              </button>
            </div>
          ))}
        </FocusGroup>
        <button type="button" onClick={() => workspace.addType('')}>
          Add type
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
