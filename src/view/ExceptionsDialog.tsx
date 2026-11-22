import { useState } from 'react'
import { useApp } from './AppProvider'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'
export function ExceptionsDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useApp()
  useStore(workspace)
  // The exception awaiting confirmation, with how many Components lose it.
  const [pending, setPending] = useState<{ id: string; uses: number } | null>(null)
  // Removing an unused exception loses nothing, so only used ones need a confirmation.
  const remove = (id: string) => {
    const uses = workspace.exceptionUsage(id)
    if (uses === 0) workspace.removeException(id)
    else setPending({ id, uses })
  }
  const confirm = () => {
    if (pending) workspace.removeException(pending.id)
    setPending(null)
  }
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Exceptions">
        <FocusGroup className="dialog-fields">
          {workspace.exceptions.map((exception, i) => (
            <div className="field-row" key={exception.id}>
              <input
                type="text"
                aria-label={`Exception ${i + 1} name`}
                value={exception.name}
                onChange={(e) => workspace.renameException(exception.id, e.target.value)}
              />
              <button type="button" aria-label={`Remove exception ${i + 1}`} onClick={() => remove(exception.id)}>
                ×
              </button>
            </div>
          ))}
        </FocusGroup>
        {pending && (
          <div role="alertdialog" aria-labelledby="confirm-exception-title">
            <p id="confirm-exception-title">
              Used by {pending.uses} component{pending.uses === 1 ? '' : 's'}. Remove it from {pending.uses === 1 ? 'it' : 'them'} and delete?
            </p>
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={confirm}>
              Delete
            </button>
          </div>
        )}
        <button type="button" onClick={() => workspace.addException('')}>
          Add exception
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
