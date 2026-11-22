import type { ComponentDefinition } from '../domain/ComponentDefinition'
import type { NewPort, Port } from '../domain/Details'
import type { Diagram } from '../domain/Diagram'
import type { Placement } from '../domain/Placement'
import type { Resource } from '../domain/Resource'
import { RESOURCE_KINDS } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import type { DeleteFlow } from './DeleteFlow'
import { availableEnvironmentVariables } from './environmentVariableEdit'
import { availableExceptions } from './exceptionEdit'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'

interface InspectorProps {
  /** The selected Placement. App renders no Inspector when nothing is selected. */
  item: Placement
  /** Sidebar width in px; owned by App so it survives selection changes. */
  width: number
  /** The Diagram that contains `item`; DeleteFlow removes it from here. */
  diagram: Diagram
  deleteFlow: DeleteFlow
}

type ListField = 'inputs' | 'outputs'

export function Inspector({ item, diagram, deleteFlow, width }: InspectorProps) {
  // Re-render on every model change so the inputs always show the live values.
  const { workspace } = useApp()
  useStore(workspace)
  const resource = workspace.resources.get(item.resourceId)
  // A removed Resource drops its Placements in the same step, so this only guards a stale render.
  if (!resource) return null
  const definition = resource.definition
  const idPrefix = `inspector-${item.id}`

  // Edits replace the whole list; Workspace.setPorts also drops the Links of removed ports.
  const list = (res: Resource, def: ComponentDefinition, field: ListField, label: string, noun: string) => {
    const ports = def.details[field]
    const set = (next: NewPort[]) => workspace.setPorts(res.id, field, next)
    const update = (i: number, change: Partial<Port>) => set(ports.map((p, j) => (j === i ? { ...p, ...change } : p)))
    return (
      <div>
        <label>{label}</label>
        {ports.map((port, i) => (
          <div className="field-row" key={port.id}>
            <input type="text" aria-label={`${noun} ${i + 1} name`} value={port.name} onChange={(e) => update(i, { name: e.target.value })} />
            <select aria-label={`${noun} ${i + 1} type`} value={port.typeId ?? ''} onChange={(e) => update(i, { typeId: e.target.value || null })}>
              <option value="">No type</option>
              {workspace.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || 'Unnamed type'}
                </option>
              ))}
            </select>
            <button type="button" aria-label={`Remove ${noun} ${i + 1}`} onClick={() => set(ports.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set([...ports, { name: '', typeId: null }])}>
          Add {noun}
        </button>
      </div>
    )
  }
  const exceptions = (def: ComponentDefinition) => {
    const names = new Map(workspace.exceptions.map((e) => [e.id, e.name]))
    const available = availableExceptions(workspace.exceptions, def.exceptionIds)
    return (
      <div>
        <label htmlFor={`${idPrefix}-add-exception`}>Exceptions</label>
        {def.exceptionIds.map((id, i) => (
          <div className="field-row" key={id}>
            <span>{names.get(id) || 'Unnamed exception'}</span>
            <button
              type="button"
              aria-label={`Remove exception ${i + 1}`}
              onClick={() => def.setExceptions(def.exceptionIds.filter((e) => e !== id))}
            >
              ×
            </button>
          </div>
        ))}
        {/* Controlled at '' so choosing an entry adds it and the select returns to its prompt. */}
        <select
          id={`${idPrefix}-add-exception`}
          value=""
          disabled={available.length === 0}
          onChange={(e) => def.setExceptions([...def.exceptionIds, e.target.value])}
        >
          <option value="">Add exception</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name || 'Unnamed exception'}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const environmentVariables = (def: ComponentDefinition) => {
    const names = new Map(workspace.environmentVariables.map((v) => [v.id, v.name]))
    const available = availableEnvironmentVariables(workspace.environmentVariables, def.environmentVariableIds)
    return (
      <div>
        <label htmlFor={`${idPrefix}-add-environment-variable`}>Environment variables</label>
        {def.environmentVariableIds.map((id, i) => (
          <div className="field-row" key={id}>
            <span>{names.get(id) || 'Unnamed environment variable'}</span>
            <button
              type="button"
              aria-label={`Remove environment variable ${i + 1}`}
              onClick={() => def.setEnvironmentVariables(def.environmentVariableIds.filter((v) => v !== id))}
            >
              ×
            </button>
          </div>
        ))}
        {/* Controlled at '' so choosing an entry adds it and the select returns to its prompt. */}
        <select
          id={`${idPrefix}-add-environment-variable`}
          value=""
          disabled={available.length === 0}
          onChange={(e) => def.setEnvironmentVariables([...def.environmentVariableIds, e.target.value])}
        >
          <option value="">Add environment variable</option>
          {available.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name || 'Unnamed environment variable'}
            </option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <aside className="inspector" style={{ width }} aria-label="Details">
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
        {definition && (
          <>
            {list(resource, definition, 'inputs', 'Inputs', 'input')}
            {list(resource, definition, 'outputs', 'Outputs', 'output')}
            {exceptions(definition)}
            {environmentVariables(definition)}
            <div>
              <label htmlFor={`${idPrefix}-notes`}>Notes</label>
              <textarea
                id={`${idPrefix}-notes`}
                rows={4}
                value={definition.details.notes}
                onChange={(e) => definition.details.patch({ notes: e.target.value })}
              />
            </div>
          </>
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
