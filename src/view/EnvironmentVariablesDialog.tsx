import { useState } from 'react'
import { useApp } from './AppProvider'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'

export function EnvironmentVariablesDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useApp()
  useStore(workspace)
  // The variable awaiting confirmation, with how many Components lose it.
  const [pending, setPending] = useState<{ id: string; uses: number } | null>(null)

  // Removing an unused variable loses nothing, so only used ones need a confirmation.
  const remove = (id: string) => {
    const uses = workspace.environmentVariableUsage(id)
    if (uses === 0) workspace.removeEnvironmentVariable(id)
    else setPending({ id, uses })
  }
  const confirm = () => {
    if (pending) workspace.removeEnvironmentVariable(pending.id)
    setPending(null)
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Environment variables">
        <FocusGroup className="dialog-fields">
          {workspace.environmentVariables.map((variable, i) => (
            <div className="field-row" key={variable.id}>
              <input
                type="text"
                aria-label={`Environment variable ${i + 1} name`}
                value={variable.name}
                onChange={(e) => workspace.renameEnvironmentVariable(variable.id, e.target.value)}
              />
              <button type="button" aria-label={`Remove environment variable ${i + 1}`} onClick={() => remove(variable.id)}>
                ×
              </button>
            </div>
          ))}
        </FocusGroup>
        {pending && (
          <div role="alertdialog" aria-labelledby="confirm-environment-variable-title">
            <p id="confirm-environment-variable-title">
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
        <button type="button" onClick={() => workspace.addEnvironmentVariable('')}>
          Add environment variable
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
