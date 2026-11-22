import type { Diagram } from '../domain/Diagram'
import type { Placement } from '../domain/Placement'
import { RESOURCE_KINDS } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import type { DeleteFlow } from './DeleteFlow'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'

interface ResourceInspectorProps {
  /** The selected Placement. App renders no Inspector when nothing is selected. */
  item: Placement
  /** Sidebar width in px; owned by App so it survives selection changes. */
  width: number
  /** The Diagram that contains `item`; DeleteFlow removes it from here. */
  diagram: Diagram
  deleteFlow: DeleteFlow
}

export function ResourceInspector({ item, diagram, deleteFlow, width }: ResourceInspectorProps) {
  const { workspace } = useApp()
  // Re-render on every model change so the inputs always show the live values.
  useStore(workspace)
  const resource = workspace.resources.get(item.resourceId)
  // A removed Resource drops its Placements in the same step, so this only guards a stale render.
  if (!resource) return null
  const idPrefix = `inspector-${item.id}`

  return (
    <aside className="inspector" style={{ width }} aria-label="Resource details">
      <FocusGroup className="inspector-fields">
        <div>
          <label htmlFor={`${idPrefix}-name`}>Name</label>
          <input id={`${idPrefix}-name`} type="text" value={resource.name} onChange={(e) => resource.setName(e.target.value)} />
        </div>
        {RESOURCE_KINDS[resource.kind].typed && (
          <div>
            <label htmlFor={`${idPrefix}-type`}>Data Type</label>
            <select
              id={`${idPrefix}-type`}
              value={resource.typeId ?? ''}
              onChange={(e) => workspace.setResourceType(resource.id, e.target.value)}
            >
              {workspace.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || 'Unnamed type'}
                </option>
              ))}
            </select>
          </div>
        )}
      </FocusGroup>
      <button type="button" className="btn-danger" onClick={() => deleteFlow.request(diagram, { kind: 'placement', id: item.id })}>
        Delete
      </button>
      <button type="button" className="btn-danger" onClick={() => deleteFlow.request(diagram, { kind: 'resource', id: resource.id })}>
        Delete resource
      </button>
    </aside>
  )
}
