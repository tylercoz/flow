import { useState } from 'react'
import { DomainError } from '../domain/DomainError'
import type { Diagram } from '../domain/Diagram'
import type { Position } from '../domain/NodeBounds'
import { RESOURCE_KINDS, type ResourceKind } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import { ResourceIcon } from './resourceIcons'
import { useStore } from './useStore'

export const KIND_LABELS: Record<ResourceKind, string> = {
  database: 'Database',
  artifact: 'Artifact',
  user: 'User',
  'input-object': 'Input object',
  component: 'Component',
}

type Props = { kind: ResourceKind; diagram: Diagram; position: Position; onClose: () => void }

export function ResourcePicker({ kind, diagram, position, onClose }: Props) {
  const { workspace, notifier } = useApp()
  useStore(workspace)
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('')
  const typed = RESOURCE_KINDS[kind].typed
  const noTypes = typed && workspace.types.length === 0
  const label = KIND_LABELS[kind]

  // Domain errors (e.g. a Resource deleted while the dialog is open) are shown, not swallowed.
  const run = (action: () => void) => {
    try {
      action()
      onClose()
    } catch (e) {
      if (!(e instanceof DomainError)) throw e
      notifier.post('resource-picker', e.message, 'transient')
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`${label} picker`}>
        <div className="dialog-fields">
          {/* A component that would contain this Diagram is hidden: placing it would close a reference cycle. */}
          {workspace.resources
            .byKind(kind)
            .filter((resource) => !workspace.wouldCreateCycle(diagram, resource.id))
            .map((resource) => (
            <button type="button" className="picker-item" key={resource.id} onClick={() => run(() => diagram.addPlacement(resource.id, position))}>
              <ResourceIcon kind={kind} /> {resource.name || 'Unnamed'}
            </button>
          ))}
        </div>
        <form
          className="dialog-fields"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => workspace.createPlacedResource(diagram, { kind, name, typeId: typed ? typeId : undefined }, position))
          }}
        >
          <div className="field-row">
            <input type="text" aria-label="New resource name" value={name} onChange={(e) => setName(e.target.value)} disabled={noTypes} />
          </div>
          {typed && (
            <div className="field-row">
              <select aria-label="Data Type" value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={noTypes}>
                <option value="">Choose a Data Type</option>
                {workspace.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {noTypes && <p>Add a Data Type first</p>}
          <button type="submit" disabled={noTypes || (typed && typeId === '')}>
            Create {label.toLowerCase()}
          </button>
        </form>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
